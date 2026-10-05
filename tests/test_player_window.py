import unittest
from unittest.mock import patch
from flask import Flask
from player_window import register_player_window


class PlayerWindowTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        register_player_window(app)
        self.client = app.test_client()

    @patch('player_window.subprocess.Popen')
    @patch('player_window.shutil.which', return_value='/usr/bin/firefox')
    def test_normal_window_command(self, which, launch):
        response = self.client.post('/test/player-window', json={'path': '/presentacio/2'},
                                    headers={'Origin': 'http://localhost', 'User-Agent': 'Firefox/144.0'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(launch.call_args.args[0], ['/usr/bin/firefox', '--new-window', 'http://localhost/?shell_target=%2Fpresentacio%2F2'])

    @patch('player_window.subprocess.Popen')
    def test_remote_and_foreign_origin_do_not_launch(self, launch):
        self.assertEqual(self.client.post('/test/player-window', headers={'Origin': 'https://other.test'}).status_code, 403)
        self.assertEqual(self.client.post('/test/player-window', headers={'Origin': 'http://localhost'}, environ_overrides={'REMOTE_ADDR': '192.168.0.2'}).status_code, 403)
        launch.assert_not_called()

    @patch('player_window.subprocess.Popen')
    def test_external_target_rejected(self, launch):
        self.assertEqual(self.client.post('/test/player-window', json={'path': '//other.test'}, headers={'Origin': 'http://localhost'}).status_code, 400)
        launch.assert_not_called()
