// ---------------------------------------------------------------------------
// Unit test: Schema.org type helpers
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { toJsonLdScript } from '@/lib/schema/types';
import type { WithContext, Restaurant } from 'schema-dts';

describe('toJsonLdScript', () => {
  it('wraps a typed Schema.org object in a script tag', () => {
    const data: WithContext<Restaurant> = {
      '@context': 'https://schema.org',
      '@type': 'Restaurant',
      name: 'Charcoal N Chill',
    };

    const result = toJsonLdScript(data);

    expect(result).toContain('<script type="application/ld+json">');
    expect(result).toContain('"@context": "https://schema.org"');
    expect(result).toContain('"@type": "Restaurant"');
    expect(result).toContain('"name": "Charcoal N Chill"');
    expect(result).toContain('</script>');
  });
});
