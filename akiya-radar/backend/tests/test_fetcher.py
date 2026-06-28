"""Exercise the real fetcher against a local HTTP server (no external network)."""

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.services import fetcher

PAGE = "<html><body><h1>テスト物件</h1><p>価格 380万円</p></body></html>"


class _Handler(BaseHTTPRequestHandler):
    robots = "User-agent: *\nAllow: /\n"

    def log_message(self, *args):  # silence test server logs
        pass

    def do_GET(self):
        if self.path == "/robots.txt":
            body = self.robots.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
        elif self.path == "/blocked":
            self.send_response(404)
            self.end_headers()
            return
        else:
            body = PAGE.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture()
def server():
    httpd = HTTPServer(("127.0.0.1", 0), _Handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address
    yield f"http://{host}:{port}"
    httpd.shutdown()


def test_fetch_html_success(server):
    html = fetcher.fetch_html(f"{server}/bukken/1")
    assert html is not None
    assert "テスト物件" in html


def test_fetch_html_non_200_returns_none(server):
    assert fetcher.fetch_html(f"{server}/blocked") is None


def test_robots_allows(server):
    assert fetcher.is_fetch_allowed(f"{server}/bukken/1") is True


def test_robots_disallow_blocks_fetch(server, monkeypatch):
    monkeypatch.setattr(_Handler, "robots", "User-agent: *\nDisallow: /\n")
    assert fetcher.is_fetch_allowed(f"{server}/bukken/1") is False
    assert fetcher.fetch_html(f"{server}/bukken/1") is None


def test_invalid_scheme_not_allowed():
    assert fetcher.is_fetch_allowed("ftp://example.com/x") is False
