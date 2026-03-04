#!/bin/bash
# ---------------------------------------------------------------------------
# scripts/launch-verify.sh — Launch Verification Script (P7-FIX-32)
#
# Verifies that a deployed LocalVector.ai instance meets production
# requirements: redirects, security headers, routes, SSL.
#
# Usage: ./scripts/launch-verify.sh https://localvector.ai
# ---------------------------------------------------------------------------

set -euo pipefail
DOMAIN="${1:-https://localvector.ai}"
PASS=0
FAIL=0

# Extract hostname from DOMAIN (strip protocol)
HOSTNAME=$(echo "$DOMAIN" | sed 's|https\?://||' | sed 's|/.*||')

check() {
  local label="$1"
  local condition="$2"
  if eval "$condition" &>/dev/null; then
    echo "  ✅ $label"
    ((PASS++))
  else
    echo "  ❌ $label"
    ((FAIL++))
  fi
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  LocalVector.ai Launch Verification"
echo "  Domain: $DOMAIN"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "[ Redirects ]"
check "HTTP → HTTPS redirect (301)" \
  "[ \$(curl -so /dev/null -w '%{http_code}' http://$HOSTNAME) = '301' ]"

echo ""
echo "[ Security Headers ]"
HEADERS=$(curl -sI "$DOMAIN")
check "Strict-Transport-Security" "echo '$HEADERS' | grep -qi 'strict-transport-security'"
check "X-Frame-Options"           "echo '$HEADERS' | grep -qi 'x-frame-options'"
check "X-Content-Type-Options"    "echo '$HEADERS' | grep -qi 'x-content-type-options'"
check "Content-Security-Policy"   "echo '$HEADERS' | grep -qi 'content-security-policy'"
check "X-Request-Id"              "echo '$HEADERS' | grep -qi 'x-request-id'"

echo ""
echo "[ Routes ]"
check "Homepage (200)"     "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN) = '200' ]"
check "Health check (200)" "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/api/health) = '200' ]"
check "robots.txt (200)"   "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/robots.txt) = '200' ]"
check "sitemap.xml (200)"  "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/sitemap.xml) = '200' ]"
check "Privacy page (200)" "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/privacy) = '200' ]"
check "/dashboard requires auth (302)" \
  "[ \$(curl -so /dev/null -w '%{http_code}' $DOMAIN/dashboard) = '302' ]"

echo ""
echo "[ SSL ]"
SSL_EXPIRY=$(echo | openssl s_client -connect "$HOSTNAME:443" 2>/dev/null \
  | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
echo "  📋 Certificate expires: ${SSL_EXPIRY:-unknown}"
check "SSL valid (>30 days)" \
  "echo | openssl s_client -connect $HOSTNAME:443 2>/dev/null | openssl x509 -noout -checkend 2592000"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed, $FAIL failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -eq 0 ] || exit 1
