"""Sum restart rules with deferred workers, without MQTT or real waits."""
import copy
import unittest
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle1 import Puzzle1


class Puzzle1Tests(unittest.TestCase):
    def setUp(self):
        self.client = Mock()
        self.updates = []
        self.client.push_update.side_effect = lambda data: self.updates.append(copy.deepcopy(data))
        self.puzzle = Puzzle1(self.client)
        self.workers = []

        def defer(target, args=(), daemon=False):
            self.workers.append(lambda: target(*args))
            return Mock()

        threads = patch('mqtt.puzzles.puzzle1.threading.Thread', side_effect=defer)
        sleeps = patch('mqtt.puzzles.puzzle1.time.sleep')
        threads.start()
        sleeps.start()
        self.addCleanup(threads.stop)
        self.addCleanup(sleeps.stop)
        self.puzzle.reset()
        self.board()

    def board(self):
        self.puzzle.operations_with_metadata = [[5, 1, 'Y'], [8, 2, 'N']]

    def repeat(self):
        self.puzzle.handle_message(['P1', '2', '3'])

    def finish_worker(self):
        self.workers.pop(0)()

    def ten_errors(self):
        for index in range(10):
            self.board()
            self.repeat()
            self.assertTrue(self.updates[-1]['incorrect']['resets_round'])
            self.assertEqual(self.puzzle.round_errors, index + 1)
            self.finish_worker()
        self.board()

    def test_first_ten_duplicates_reset_then_repeated_sum_keeps_board(self):
        self.ten_errors()
        before = copy.deepcopy(self.puzzle.operations_with_metadata)
        self.repeat()
        event = self.updates[-1]
        self.assertEqual(event['incorrect']['reason'], 'already_solved')
        self.assertFalse(event['incorrect']['resets_round'])
        self.assertEqual(event['incorrect']['display_ms'], 5000)
        self.assertEqual(self.puzzle.operations_with_metadata, before)
        self.assertEqual(self.puzzle.round_errors, 10)
        self.assertFalse(self.puzzle.processing_wrong_result)
        self.assertEqual(self.workers, [])
        self.assertNotIn('start_timer', event)

    def test_tenth_error_still_resets(self):
        self.puzzle.round_errors = 9
        self.repeat()
        self.assertTrue(self.updates[-1]['incorrect']['resets_round'])
        self.assertTrue(self.puzzle.processing_wrong_result)
        self.finish_worker()
        self.assertTrue(self.updates[-1]['start_timer'])
        self.assertTrue(all(op[2] == 'N' for op in self.puzzle.operations_with_metadata))

    def test_nonexistent_sum_always_resets(self):
        for errors in (0, 9, 10, 20):
            with self.subTest(errors=errors):
                self.board()
                self.puzzle.round_errors = errors
                self.puzzle.handle_message(['P1', '20', '20'])
                self.assertEqual(self.updates[-1]['incorrect']['reason'], 'not_existing')
                self.assertTrue(self.updates[-1]['incorrect']['resets_round'])
                self.assertEqual(self.puzzle.round_errors, errors + 1)
                self.finish_worker()
                self.assertTrue(self.updates[-1]['start_timer'])

    def test_timeout_counts_towards_ten_restarts(self):
        self.puzzle.round_errors = 9
        self.puzzle.timer_expired()
        self.assertEqual(self.puzzle.round_errors, 10)
        self.finish_worker()
        self.assertTrue(self.updates[-1]['start_timer'])
        self.board()
        self.repeat()
        self.assertFalse(self.updates[-1]['incorrect']['resets_round'])

    def test_timeout_still_resets_during_nonblocking_duplicate_feedback(self):
        self.puzzle.round_errors = 10
        self.repeat()
        self.puzzle.timer_expired()
        self.assertTrue(self.puzzle.processing_wrong_result)
        self.assertEqual(self.puzzle.round_errors, 11)
        self.finish_worker()
        self.assertTrue(self.updates[-1]['start_timer'])

    def test_valid_sum_can_complete_during_nonblocking_feedback(self):
        self.puzzle.round_errors = 10
        self.repeat()
        self.puzzle.handle_message(['P1', '4', '4'])
        self.assertTrue(self.puzzle.solved)
        self.assertTrue(self.updates[-1]['puzzle_solved'])
        self.client.send_message.assert_called_once_with('FROM_FLASK', 'P1End')
        self.assertEqual(self.workers, [])

    def test_reset_starts_error_count_from_zero(self):
        self.puzzle.round_errors = 10
        self.puzzle.reset()
        self.board()
        self.repeat()
        self.assertEqual(self.puzzle.round_errors, 1)
        self.assertTrue(self.updates[-1]['incorrect']['resets_round'])

    def test_pending_reset_ignores_repeated_messages_and_timeout(self):
        self.repeat()
        self.repeat()
        self.puzzle.timer_expired()
        self.assertEqual(self.puzzle.round_errors, 1)
        self.assertEqual(len(self.workers), 1)

    def test_always_correct_does_not_count_or_publish_errors(self):
        self.puzzle.alwaysCorrect = True
        count = len(self.updates)
        self.repeat()
        self.assertEqual(len(self.updates), count)
        self.assertEqual(self.puzzle.round_errors, 0)
        self.assertEqual(self.workers, [])

    def test_old_workers_cannot_reset_a_stopped_or_new_game(self):
        for timeout in (False, True):
            for restart in (False, True):
                with self.subTest(timeout=timeout, restart=restart):
                    self.puzzle.reset()
                    self.board()
                    if timeout:
                        self.puzzle.timer_expired()
                    else:
                        self.repeat()
                    if restart:
                        self.puzzle.reset()
                    else:
                        self.puzzle.stop()
                    count = len(self.updates)
                    before = copy.deepcopy(self.puzzle.operations_with_metadata)
                    self.finish_worker()
                    self.assertEqual(len(self.updates), count)
                    self.assertEqual(self.puzzle.operations_with_metadata, before)


if __name__ == '__main__':
    unittest.main()