import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  clientIpFrom,
  configuredIpHeader,
  parseClientIp,
  trustProxyHeaders,
} from './client-ip.ts'

function request(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/auth/signin', { method: 'POST', headers })
}

test('x-forwarded-for is read client-first', () => {
  assert.equal(parseClientIp('203.0.113.7, 70.41.3.18, 150.172.238.178'), '203.0.113.7')
})

test('the header value is trimmed', () => {
  assert.equal(parseClientIp('  203.0.113.7  , 10.0.0.1'), '203.0.113.7')
})

test('a single-value header is used as-is', () => {
  assert.equal(parseClientIp('198.51.100.4', 'x-real-ip'), '198.51.100.4')
})

test('IPv6 addresses are accepted', () => {
  assert.equal(parseClientIp('2001:db8::1'), '2001:db8::1')
})

test('anything that is not a literal IP is refused', () => {
  for (const value of [null, undefined, '', '   ', 'unknown', 'example.com', '203.0.113.7:8080', ',203.0.113.7']) {
    assert.equal(parseClientIp(value), null, `expected ${JSON.stringify(value)} to be refused`)
  }
})

test('proxy headers are trusted only when explicitly enabled', () => {
  assert.equal(trustProxyHeaders({}), false)
  assert.equal(trustProxyHeaders({ TRUST_PROXY_HEADERS: '' }), false)
  assert.equal(trustProxyHeaders({ TRUST_PROXY_HEADERS: 'false' }), false)
  assert.equal(trustProxyHeaders({ TRUST_PROXY_HEADERS: 'true' }), true)
  assert.equal(trustProxyHeaders({ TRUST_PROXY_HEADERS: '1' }), true)
})

test('the IP header is configurable and defaults to x-forwarded-for', () => {
  assert.equal(configuredIpHeader({}), 'x-forwarded-for')
  assert.equal(configuredIpHeader({ TRUSTED_IP_HEADER: 'X-Real-IP' }), 'x-real-ip')
  assert.equal(configuredIpHeader({ TRUSTED_IP_HEADER: ' cf-connecting-ip ' }), 'cf-connecting-ip')
})

test('no IP is reported while proxy headers are untrusted', () => {
  const env = {}
  assert.equal(clientIpFrom(request({ 'x-forwarded-for': '203.0.113.7' }), env), null)
})

test('the client IP is reported once trust is enabled', () => {
  const env = { TRUST_PROXY_HEADERS: 'true' }
  assert.equal(clientIpFrom(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }), env), '203.0.113.7')
})

test('the configured header is the one that is read', () => {
  const env = { TRUST_PROXY_HEADERS: 'true', TRUSTED_IP_HEADER: 'x-real-ip' }
  assert.equal(clientIpFrom(request({ 'x-forwarded-for': '203.0.113.7', 'x-real-ip': '198.51.100.4' }), env), '198.51.100.4')
})

test('a missing or unusable header yields no IP rather than a shared bucket', () => {
  const env = { TRUST_PROXY_HEADERS: 'true' }
  assert.equal(clientIpFrom(request({}), env), null)
  assert.equal(clientIpFrom(request({ 'x-forwarded-for': 'not-an-ip' }), env), null)
})
