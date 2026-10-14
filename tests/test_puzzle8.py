import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from mqtt.puzzles.puzzle8 import Puzzle8


class Puzzle8UnorderedAnswersTest(unittest.TestCase):
    def setUp(self):
        self.client = SimpleNamespace(
            current_puzzle_id=8,
            push_update=Mock(),
            send_message=Mock(),
            start_next_round=Mock(),
        )
        self.puzzle = Puzzle8(self.client)
        self.puzzle.round = 1
        self.puzzle.phase = 'input'
        self.puzzle._schedule = Mock()
        symbols = self.puzzle.symbols
        self.puzzle.target_sets = [
            {'symbols': symbols[:], 'colors': dict.fromkeys(symbols, 'red')},
            {'symbols': symbols[1:] + symbols[:1], 'colors': dict.fromkeys(symbols, 'blue')},
        ]
        self.thread = self.enterContext(patch('mqtt.puzzles.puzzle8.threading.Thread'))
        self.enterContext(patch('builtins.print'))

    def expected(self, box):
        return [
            (target['symbols'][box], target['colors'][target['symbols'][box]])
            for target in self.puzzle.target_sets
        ]

    def submit(self, box, pair):
        symbol, color = pair
        self.puzzle.handle_message([
            'P8',
            str(self.puzzle.symbol_name_to_code[symbol]),
            str(self.puzzle.number_to_code_map[self.puzzle.token_numbers[box]]),
            str(self.puzzle.color_name_to_code[color]),
        ])

    def fill_round(self, reverse=False, mixed=False, override_first=None):
        for box in range(10):
            pairs = self.expected(box)
            if reverse or (mixed and box % 2):
                pairs.reverse()
            if box == 0 and override_first is not None:
                pairs = override_first
            for pair in pairs:
                self.submit(box, pair)

    def finish_evaluation(self, advance_retry=True):
        self.thread.assert_called_once()
        self.thread.return_value.start.assert_called_once()
        # Run the real result/retry flow without background waits or MQTT.
        with patch('mqtt.puzzles.puzzle8.time.sleep'):
            self.thread.call_args.kwargs['target']()
        if advance_retry and self.puzzle.phase == 'retry':
            self.puzzle._schedule.call_args.args[0]()
        return next(
            call.args[0]['input_result']
            for call in reversed(self.client.push_update.call_args_list)
            if 'input_result' in call.args[0]
        )

    def test_either_correct_pair_can_be_the_first_pass(self):
        self.assertEqual(self.puzzle.get_state()['input_status'][0], 'pending')
        self.submit(0, self.expected(0)[1])
        self.submit(1, self.expected(1)[0])
        state = self.puzzle.get_state()
        self.assertEqual(state['input_status'][0], 'partial')
        self.assertEqual(state['input_status'][1], 'partial')
        self.assertEqual(state['input_required'], 2)
        self.thread.assert_not_called()

    def test_display_order_still_solves_the_round(self):
        self.fill_round()
        result = self.finish_evaluation()
        self.assertTrue(result['success'])
        self.assertTrue(self.puzzle.solved)

    def test_reverse_order_solves_and_snapshot_keeps_arrival_order(self):
        self.fill_round(reverse=True)
        state = self.puzzle.get_state()
        self.assertEqual(set(state['input_status'].values()), {'complete'})
        self.assertEqual(
            state['input_entries'][0],
            [{'symbol': symbol, 'color': color} for symbol, color in reversed(self.expected(0))],
        )
        result = self.finish_evaluation()
        self.assertTrue(result['success'])
        self.assertTrue(all(result['box_results'].values()))
        self.assertTrue(self.puzzle.solved)
        self.client.send_message.assert_called_once_with('FROM_FLASK', 'P8End')

    def test_each_token_can_use_a_different_order(self):
        self.fill_round(mixed=True)
        self.assertTrue(self.finish_evaluation()['success'])

    def test_repeating_one_pair_does_not_replace_the_other(self):
        first, _ = self.expected(0)
        self.fill_round(override_first=[first, first])
        self.assertEqual(self.puzzle.get_state()['input_status'][0], 'wrong')
        result = self.finish_evaluation()
        self.assertFalse(result['success'])
        self.assertFalse(result['box_results'][0])
        self.assertTrue(all(result['box_results'][box] for box in range(1, 10)))
        self.assertFalse(self.puzzle.solved)
        self.client.send_message.assert_not_called()
        self.assertEqual(self.puzzle.phase, 'numbers')
        self.assertEqual(set(self.puzzle.player_symbols), set(range(1, 10)))
        self.assertEqual(self.puzzle.confirmed_boxes, set(range(1, 10)))
        self.assertEqual(len(self.puzzle.target_sets), 2)
        retry = self.client.push_update.call_args.args[0]
        self.assertEqual(retry['phase'], 'numbers')
        self.assertEqual(retry['confirmed_boxes'], list(range(1, 10)))
        self.assertEqual(retry['token_numbers'], self.puzzle.token_numbers)
        self.puzzle._schedule.assert_any_call(self.puzzle._resume_retry, 10)
        self.puzzle._schedule.assert_called_with(self.puzzle._show_tokens, 5)

    def test_failed_attempt_waits_ten_seconds_with_container_summary(self):
        first = self.expected(0)[0]
        self.fill_round(override_first=[first, first])
        with patch('mqtt.puzzles.puzzle8.time.monotonic', return_value=100) as clock:
            result = self.finish_evaluation(advance_retry=False)
            self.assertFalse(result['success'])
            state = self.puzzle.get_state()
            self.assertEqual(state['phase'], 'retry')
            self.assertEqual(state['retry_summary'], {'errors': 1, 'accumulated_correct': 9})
            self.assertEqual(state['phase_duration_ms'], 10000)
            self.assertEqual(state['phase_remaining_ms'], 10000)
            payload = self.client.push_update.call_args.args[0]
            self.assertEqual(payload['retry_summary'], state['retry_summary'])
            self.assertEqual(payload['phase'], 'retry')
            self.puzzle._schedule.assert_called_once_with(self.puzzle._resume_retry, 10)
            clock.return_value = 104
            self.assertEqual(self.puzzle.get_state()['phase_remaining_ms'], 6000)
            before = self.client.push_update.call_count
            self.submit(0, self.expected(0)[1])
            self.assertEqual(self.client.push_update.call_count, before)
            clock.return_value = 110
            self.puzzle._schedule.call_args.args[0]()
            self.assertEqual(self.puzzle.phase, 'numbers')
            self.assertEqual(self.puzzle.get_state()['phase_remaining_ms'], 5000)
            self.assertNotIn(0, self.puzzle.player_symbols)
            self.assertEqual(self.puzzle.confirmed_boxes, set(range(1, 10)))

    def test_results_stay_on_the_board_five_seconds_before_retry_countdown(self):
        first = self.expected(0)[0]
        self.fill_round(override_first=[first, first])

        def check_wait(seconds):
            if seconds != 5:
                return
            state = self.puzzle.get_state()
            self.assertEqual(state['phase'], 'input')
            self.assertFalse(state['input_result']['success'])
            self.assertFalse(state['input_result']['box_results'][0])
            self.assertTrue(state['input_result']['box_results'][1])
            self.assertEqual(len(state['input_entries'][0]), 2)
            self.assertEqual(len(state['input_entries'][1]), 2)
            self.assertEqual(state['phase_remaining_ms'], 0)
            self.puzzle._schedule.assert_not_called()
            self.assertNotIn('retry_summary', self.client.push_update.call_args.args[0])

        with patch('mqtt.puzzles.puzzle8.time.sleep', side_effect=check_wait) as wait:
            self.thread.call_args.kwargs['target']()
        self.assertEqual([call.args[0] for call in wait.call_args_list], [2, 5])
        self.assertEqual(self.puzzle.phase, 'retry')
        self.puzzle._schedule.assert_called_once_with(self.puzzle._resume_retry, 10)
        self.assertNotIn('input_result', self.client.push_update.call_args.args[0])

    def test_stopping_while_results_are_visible_prevents_countdown(self):
        first = self.expected(0)[0]
        self.fill_round(override_first=[first, first])

        def stop_during_results(seconds):
            if seconds == 5:
                self.puzzle.stop()

        with patch('mqtt.puzzles.puzzle8.time.sleep', side_effect=stop_during_results):
            self.thread.call_args.kwargs['target']()
        self.assertEqual(self.puzzle.phase, 'idle')
        self.puzzle._schedule.assert_not_called()

    def test_retry_summary_includes_previously_confirmed_containers(self):
        for box in range(10):
            pairs = self.expected(box)
            for pair in (pairs if box < 8 else [pairs[0], pairs[0]]):
                self.submit(box, pair)
        self.finish_evaluation()
        self.retry_input()
        for pair in self.expected(8):
            self.submit(8, pair)
        first = self.expected(9)[0]
        self.submit(9, first)
        self.submit(9, first)
        self.finish_evaluation(advance_retry=False)
        self.assertEqual(self.puzzle.get_state()['retry_summary'], {
            'errors': 1, 'accumulated_correct': 9
        })

    def test_stopping_during_pause_prevents_retry(self):
        first = self.expected(0)[0]
        self.fill_round(override_first=[first, first])
        self.finish_evaluation(advance_retry=False)
        callback = self.puzzle._schedule.call_args.args[0]
        self.puzzle.stop()
        self.client.push_update.reset_mock()
        callback()
        self.assertEqual(self.puzzle.phase, 'idle')
        self.assertEqual(self.puzzle.get_state()['phase_remaining_ms'], 0)
        self.client.push_update.assert_not_called()

    def test_changing_puzzle_during_pause_prevents_retry(self):
        first = self.expected(0)[0]
        self.fill_round(override_first=[first, first])
        self.finish_evaluation(advance_retry=False)
        self.client.current_puzzle_id = 3
        self.client.push_update.reset_mock()
        self.puzzle._resume_retry()
        self.client.push_update.assert_not_called()

    def retry_input(self):
        self.puzzle._show_tokens()
        self.puzzle._enter_input_phase()
        self.thread.reset_mock()

    def test_only_failed_player_repeats_and_can_solve(self):
        original_pairs = [self.expected(box) for box in range(10)]
        first, _ = self.expected(0)
        self.fill_round(reverse=True, override_first=[first, first])
        self.assertFalse(self.finish_evaluation()['success'])
        for phase in ['numbers', 'tokens', 'input']:
            if phase == 'tokens':
                self.puzzle._show_tokens()
            elif phase == 'input':
                self.puzzle._enter_input_phase()
            state = self.puzzle.get_state()
            self.assertEqual(state['phase'], phase)
            self.assertEqual(state['confirmed_boxes'], list(range(1, 10)))
            self.assertEqual(state['confirmed_entries'][1], [
                {'symbol': symbol, 'color': color}
                for symbol, color in reversed(original_pairs[1])
            ])
            self.assertEqual([self.expected(box) for box in range(10)], original_pairs)
        self.thread.reset_mock()
        state = self.puzzle.get_state()
        self.assertEqual(state['input_counts'][0], 0)
        self.assertTrue(all(state['input_counts'][box] == 2 for box in range(1, 10)))
        before = self.client.push_update.call_count
        self.submit(1, ('sigma', 'green'))
        self.assertEqual(self.client.push_update.call_count, before)
        self.thread.assert_not_called()
        for pair in reversed(self.expected(0)):
            self.submit(0, pair)
        self.assertTrue(self.finish_evaluation()['success'])
        self.assertTrue(self.puzzle.solved)
        self.client.send_message.assert_called_once_with('FROM_FLASK', 'P8End')

    def test_confirmations_accumulate_across_multiple_retries(self):
        for box in range(10):
            pairs = self.expected(box)
            for pair in (pairs if box < 8 else [pairs[0], pairs[0]]):
                self.submit(box, pair)
        self.assertFalse(self.finish_evaluation()['success'])
        self.assertEqual(self.puzzle.confirmed_boxes, set(range(8)))
        self.retry_input()
        for pair in self.expected(8):
            self.submit(8, pair)
        first = self.expected(9)[0]
        self.submit(9, first)
        self.submit(9, first)
        self.assertFalse(self.finish_evaluation()['success'])
        self.assertEqual(self.puzzle.confirmed_boxes, set(range(9)))
        self.retry_input()
        for pair in self.expected(9):
            self.submit(9, pair)
        self.assertTrue(self.finish_evaluation()['success'])

    def test_all_wrong_retry_keeps_targets_but_no_inputs(self):
        for box in range(10):
            first = self.expected(box)[0]
            self.submit(box, first)
            self.submit(box, first)
        self.assertFalse(self.finish_evaluation()['success'])
        self.assertEqual(self.puzzle.confirmed_boxes, set())
        self.assertEqual(self.puzzle.player_symbols, {})
        self.assertEqual(len(self.puzzle.target_sets), 2)
        self.retry_input()
        self.fill_round()
        self.assertTrue(self.finish_evaluation()['success'])

    def test_stop_and_reset_clear_confirmations(self):
        first = self.expected(0)[0]
        self.fill_round(override_first=[first, first])
        self.finish_evaluation()
        self.puzzle.stop()
        self.assertEqual(self.puzzle.get_state()['confirmed_boxes'], [])
        self.assertEqual(self.puzzle.player_symbols, {})
        self.puzzle.confirmed_boxes.add(1)
        self.puzzle.reset()
        self.assertEqual(self.puzzle.get_state()['confirmed_entries'], {})
        self.assertEqual(self.puzzle.player_symbols, {})
        self.assertEqual(self.puzzle.target_sets, [])

    def test_color_must_stay_paired_with_its_symbol(self):
        first, second = self.expected(0)
        swapped_colors = [(first[0], second[1]), (second[0], first[1])]
        self.fill_round(override_first=swapped_colors)
        self.assertEqual(self.puzzle.get_state()['input_status'][0], 'wrong')
        self.assertFalse(self.finish_evaluation()['success'])
        self.assertFalse(self.puzzle.solved)

    def test_new_round_does_not_inherit_confirmed_answers(self):
        self.puzzle.round_total = 2
        self.fill_round()
        self.assertTrue(self.finish_evaluation()['success'])
        self.assertEqual(self.puzzle.round, 2)
        self.assertFalse(self.puzzle.solved)
        self.assertEqual(self.puzzle.confirmed_boxes, set())
        self.assertEqual(self.puzzle.player_symbols, {})
        self.assertEqual(self.puzzle.target_sets, [])
        self.client.start_next_round.assert_called_once_with(8, 2)

    def test_always_correct_override_still_solves(self):
        self.puzzle.alwaysCorrect = True
        first = self.expected(0)[0]
        self.fill_round(override_first=[first, first])
        self.assertTrue(self.finish_evaluation()['success'])
        self.assertTrue(self.puzzle.solved)
        self.assertEqual(self.puzzle.confirmed_boxes, set(range(10)))

    def test_wrong_symbol_is_rejected(self):
        _, second = self.expected(0)
        self.fill_round(override_first=[('sigma', 'red'), second])
        self.assertEqual(self.puzzle.get_state()['input_status'][0], 'wrong')
        self.assertFalse(self.finish_evaluation()['success'])

    def test_two_different_symbols_may_share_a_color(self):
        self.puzzle.target_sets[1]['colors'] = dict.fromkeys(self.puzzle.symbols, 'red')
        self.fill_round(reverse=True)
        self.assertTrue(self.finish_evaluation()['success'])

    def test_start_shows_tokens_immediately_then_memorise_then_answer(self):
        self.puzzle.reset()
        initial = self.client.push_update.call_args.args[0]
        self.assertEqual(initial['phase'], 'numbers')
        self.assertEqual(initial['token_numbers'], self.puzzle.token_numbers)
        self.assertEqual(self.puzzle.get_state()['phase'], 'numbers')
        self.puzzle._schedule.assert_called_once_with(self.puzzle._show_tokens, 5)

        # Follow the scheduled callbacks, verifying both display durations.
        self.puzzle._schedule.call_args.args[0]()
        memory = self.client.push_update.call_args.args[0]
        self.assertEqual(memory['phase'], 'tokens')
        self.assertEqual(len(memory['symbol_sets']), 2)
        self.assertEqual(memory['token_numbers'], initial['token_numbers'])
        self.puzzle._schedule.assert_called_with(self.puzzle._enter_input_phase, 6)

        self.puzzle._schedule.call_args.args[0]()
        answer = self.client.push_update.call_args.args[0]
        self.assertEqual(answer['phase'], 'input')
        self.assertTrue(answer['clear'])
        self.assertEqual(answer['token_numbers'], initial['token_numbers'])
        self.assertEqual(self.puzzle.get_state()['input_required'], 2)
        self.assertEqual(
            [call.args[0]['phase'] for call in self.client.push_update.call_args_list],
            ['numbers', 'tokens', 'input'],
        )

    def test_countdown_snapshot_preserves_remaining_time(self):
        with patch('mqtt.puzzles.puzzle8.time.monotonic', return_value=100) as clock:
            self.puzzle.reset()
            initial = self.client.push_update.call_args.args[0]
            self.assertEqual(initial['phase_duration_ms'], 5000)
            self.assertEqual(initial['phase_remaining_ms'], 5000)

            clock.return_value = 102
            state = self.puzzle.get_state()
            self.assertEqual(state['phase_duration_ms'], 5000)
            self.assertEqual(state['phase_remaining_ms'], 3000)

            clock.return_value = 105
            self.puzzle._show_tokens()
            memory = self.client.push_update.call_args.args[0]
            self.assertEqual(memory['phase_duration_ms'], 6000)
            self.assertEqual(memory['phase_remaining_ms'], 6000)

            clock.return_value = 107.5
            self.assertEqual(self.puzzle.get_state()['phase_remaining_ms'], 3500)

            clock.return_value = 112
            self.assertEqual(self.puzzle.get_state()['phase_remaining_ms'], 0)

            self.puzzle._enter_input_phase()
            answer = self.client.push_update.call_args.args[0]
            self.assertEqual(answer['phase_duration_ms'], 0)
            self.assertEqual(answer['phase_remaining_ms'], 0)

    def test_stop_clears_countdown_and_restart_uses_full_duration(self):
        with patch('mqtt.puzzles.puzzle8.time.monotonic', return_value=100) as clock:
            self.puzzle.reset()
            clock.return_value = 102
            self.puzzle.stop()
            state = self.puzzle.get_state()
            self.assertEqual(state['phase'], 'idle')
            self.assertEqual(state['phase_duration_ms'], 0)
            self.assertEqual(state['phase_remaining_ms'], 0)

            self.puzzle.reset()
            self.assertEqual(self.puzzle.get_state()['phase_remaining_ms'], 5000)


if __name__ == '__main__':
    unittest.main()
