import copy
import importlib
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle3 import Puzzle3


class Puzzle3ShuffledAnswersTest(unittest.TestCase):
    def setUp(self):
        self.client = SimpleNamespace(
            get_active_session_language=lambda: 'es',
            push_update=Mock(),
            send_message=Mock(),
        )
        self.puzzle = Puzzle3(self.client)
        self.puzzle._schedule_next_question = Mock()
        self.question = {
            'id': 1000,
            '_source': 'easy',
            'q': 'Test question',
            'answers': [f'Answer {i}' for i in range(10)],
            'correct': ['Y'] * 4 + ['N'] * 6,
        }
        self.puzzle.chosen_questions = [copy.deepcopy(self.question)]

    def push_shuffled(self, replacement):
        with patch.object(self.puzzle, '_pick_question_for_stage', return_value=replacement):
            with patch('mqtt.puzzles.puzzle3.random.shuffle', side_effect=lambda pairs: pairs.reverse()) as shuffle:
                self.puzzle._push_question()
                shuffle.assert_called_once()
        return self.client.push_update.call_args.args[0]

    def test_all_active_banks_have_four_correct_and_six_incorrect(self):
        for language in ('ESP', 'CAT', 'ENG'):
            for difficulty in ('easy', 'medium', 'hard'):
                module = importlib.import_module(
                    f'data.puzzle3.{difficulty}_questions.{difficulty}_{language}'
                )
                for question in module.QUESTIONS:
                    with self.subTest(language=language, difficulty=difficulty, id=question['id']):
                        self.assertEqual(len(question['answers']), 10)
                        self.assertEqual(len(question['correct']), 10)
                        expected = [self.puzzle._normalize_expected_answer(v) for v in question['correct']]
                        self.assertEqual(expected.count(5), 4)
                        self.assertEqual(expected.count(1), 6)
        for question in self.puzzle.company_bank:
            self.assertEqual(len(question['answers']), 10)
            expected = [self.puzzle._normalize_expected_answer(v) for v in question['correct']]
            self.assertEqual(expected.count(5), 4)
            self.assertEqual(expected.count(1), 6)

    def test_replacement_is_shuffled_without_mutating_the_bank(self):
        replacement = copy.deepcopy(self.question)
        replacement['id'] = 1001
        original = copy.deepcopy(replacement)
        payload = self.push_shuffled(replacement)
        active = self.puzzle.chosen_questions[0]
        self.assertEqual(payload['question']['answers'], original['answers'][::-1])
        self.assertEqual(active['correct'], original['correct'][::-1])
        self.assertEqual(replacement, original)
        self.assertIsNot(active, replacement)
        with patch('mqtt.puzzles.puzzle3.random.shuffle') as shuffle:
            for _ in range(3):
                self.assertEqual(self.puzzle.get_state()['question'], payload['question'])
            shuffle.assert_not_called()

    def test_question_is_shuffled_even_without_a_replacement(self):
        payload = self.push_shuffled(None)
        self.assertEqual(payload['question']['answers'], self.question['answers'][::-1])
        self.assertEqual(self.puzzle.chosen_questions[0]['correct'], self.question['correct'][::-1])

    def test_mqtt_validation_uses_the_displayed_order(self):
        self.push_shuffled(copy.deepcopy(self.question))
        expected = self.puzzle.chosen_questions[0]['correct']
        for slot, value in enumerate(expected):
            self.puzzle.handle_message(['P3', str(slot), '5' if value == 'Y' else '1'])
        self.assertEqual(self.puzzle.streak, 1)
        self.puzzle._schedule_next_question.assert_called_once_with(delay=7, advance=True)

    def test_marking_the_first_four_green_does_not_pass_after_shuffle(self):
        self.push_shuffled(copy.deepcopy(self.question))
        for slot in range(10):
            self.puzzle.handle_message(['P3', str(slot), '5' if slot < 4 else '1'])
        self.assertEqual(self.puzzle.streak, 0)
        self.puzzle._schedule_next_question.assert_called_once_with(delay=7, advance=False)

    def assert_result_window_blocks_answers(self, success):
        next_question = {**copy.deepcopy(self.question), 'id': 1001, 'q': 'Next question'}
        self.puzzle.chosen_questions.append(next_question)
        # Exercise the real delayed transition without starting a thread or waiting.
        self.puzzle._schedule_next_question = Puzzle3._schedule_next_question.__get__(self.puzzle)
        with patch('mqtt.puzzles.puzzle3.threading.Thread') as thread:
            for slot in range(10):
                answer = 5 if slot < 4 else 1
                if not success and slot == 0:
                    answer = 1
                self.puzzle.handle_message(['P3', str(slot), str(answer)])

            result = self.client.push_update.call_args.args[0]['question_result']
            self.assertEqual(result['success'], success)
            state = copy.deepcopy(self.puzzle.get_state())
            updates = self.client.push_update.call_count
            # Late corrections and repeated complete submissions must do nothing.
            for _ in range(2):
                for slot in range(10):
                    self.puzzle.handle_message(['P3', str(slot), '5' if slot < 4 else '1'])
            self.assertEqual(self.puzzle.get_state(), state)
            self.assertEqual(self.puzzle.streak, int(success))
            self.assertEqual(self.client.push_update.call_count, updates)
            self.client.send_message.assert_not_called()
            thread.assert_called_once()
            thread.return_value.start.assert_called_once()
            transition = thread.call_args.kwargs['target']

        with patch('mqtt.puzzles.puzzle3.time.sleep') as sleep:
            with patch.object(self.puzzle, '_pick_question_for_stage', return_value=next_question):
                transition()
            sleep.assert_called_once_with(7)
        self.assertEqual(self.puzzle.current_question_idx, int(success))
        self.assertEqual(self.puzzle.get_state()['question']['id'], 1001)
        self.assertEqual(self.puzzle.get_state()['answered_players'], [])
        self.puzzle.handle_message(['P3', '0', '5'])
        self.assertEqual(self.client.push_update.call_args.args[0]['player_answer'],
                         {'player': 0, 'answer': 5})

    def test_wrong_result_blocks_answers_until_next_question(self):
        self.assert_result_window_blocks_answers(success=False)

    def test_correct_result_blocks_answers_until_next_question(self):
        self.assert_result_window_blocks_answers(success=True)

    def test_selection_can_change_until_the_last_terminal_answers(self):
        self.puzzle.handle_message(['P3', '0', '1'])
        for slot in range(1, 9):
            self.puzzle.handle_message(['P3', str(slot), '5' if slot < 4 else '1'])
        self.puzzle.handle_message(['P3', '0', '5'])
        self.assertEqual(self.puzzle.answered_players[0], 5)
        self.assertFalse(any('question_result' in call.args[0]
                             for call in self.client.push_update.call_args_list))
        self.puzzle.handle_message(['P3', '9', '1'])
        self.assertEqual(self.puzzle.streak, 1)
        self.assertTrue(self.client.push_update.call_args.args[0]['question_result']['success'])


if __name__ == '__main__':
    unittest.main()
