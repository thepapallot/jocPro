import json
import re
import unittest
from config import PUZZLE_ORDER, PUZZLE_TUTORIAL, PUZZLE_FINAL
from presentation_fixture import create_runtime

class PresentationRoutesTests(unittest.TestCase):
    def setUp(self):
        self.app, self.mqtt = create_runtime()
        self.client = self.app.test_client()

    def page(self, path):
        response = self.client.get(path)
        self.assertEqual(response.status_code, 200, path)
        match = re.search(r'window.PYRAMID_PAGE = (.*?);</script>', response.get_data(as_text=True))
        self.assertIsNotNone(match, path)
        return json.loads(match[1])

    def test_presentations_do_not_start_hardware(self):
        self.assertEqual(self.page('/?embed=1')['sceneId'], 'welcome')
        self.assertEqual(self.page('/videoIntro')['nextUrl'], '/videoTutorial')
        for pid in [PUZZLE_TUTORIAL, *PUZZLE_ORDER, PUZZLE_FINAL]:
            data = self.page(f'/presentacio/{pid}')
            self.assertEqual(data['puzzleId'], pid)
            self.assertEqual(data['nextUrl'], f'/puzzle/{pid}')
        self.assertEqual(self.mqtt.starts, [])

    def test_each_completed_game_has_a_manual_transition_before_the_next_intro(self):
        sequence = [PUZZLE_TUTORIAL, *PUZZLE_ORDER, PUZZLE_FINAL]
        for previous, following in zip(sequence, sequence[1:]):
            data = self.page(f'/videoPuzzles/{following}')
            self.assertEqual(data['sceneId'], f'success-{previous}')
            self.assertEqual(data['nextUrl'], f'/presentacio/{following}')
        self.assertEqual(self.page('/final')['sceneId'], 'closing')

    def test_order_and_three_languages_come_from_page_context(self):
        for language in ['ca', 'es', 'eng']:
            data = self.page(f'/videoTutorial?lang={language}')
            self.assertEqual(data['language'], language)
            self.assertEqual(data['order'], PUZZLE_ORDER)
            self.assertEqual(data['tutorialId'], PUZZLE_TUTORIAL)
            self.assertEqual(data['finalId'], PUZZLE_FINAL)
        self.assertEqual(self.page('/final?lang=ca')['language'], 'ca')

    def test_actual_puzzles_keep_their_templates_and_receive_shared_theme(self):
        for pid in [PUZZLE_TUTORIAL, *PUZZLE_ORDER, PUZZLE_FINAL]:
            response = self.client.get(f'/puzzle/{pid}?lang=ca')
            self.assertEqual(response.status_code, 200)
            html = response.get_data(as_text=True)
            self.assertIn(f'css/puzzle{pid}.css', html)
            self.assertIn(f'js/puzzle{pid}.js', html)
            self.assertIn('css/game-theme.css', html)
            self.assertIn('PYRAMID_GAME', html)
        self.assertEqual(self.mqtt.starts, [])

    def test_legacy_urls_redirect_without_old_media_player(self):
        for scene, route in [('scene_intro_sumas', '/presentacio/1'),
                             ('scene_intro_game', '/videoIntro'), ('scene_final', '/final')]:
            response = self.client.get('/player/?scene='+scene+'&lang=ca')
            self.assertEqual(response.status_code, 302)
            self.assertEqual(response.location, route+'?lang=ca')
        self.assertEqual(self.client.get('/presentacio/999').status_code, 404)
        self.assertEqual(self.client.get('/explicacioPuzzles/0').status_code, 404)

if __name__ == '__main__':
    unittest.main()
