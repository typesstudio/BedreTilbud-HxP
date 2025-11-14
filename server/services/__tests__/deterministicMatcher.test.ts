import { describe, it, expect } from '@jest/globals';
import { computeBestMatches } from '../deterministicMatcher';
import type { Policy } from '@shared/schema';

function createMockPolicy(
  id: string,
  policyType: string,
  details: Record<string, any> = {}
): Policy {
  return {
    id,
    userId: 'test-user',
    documentId: 'test-doc',
    policyType,
    isOwnPolicy: true,
    coverageDetails: details,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Policy;
}

describe('deterministicMatcher', () => {
  describe('computeBestMatches', () => {
    it('should match single exact policy type', () => {
      const current = [createMockPolicy('c1', 'hus')];
      const offers = [createMockPolicy('o1', 'hus')];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]).toMatchObject({
        policyType: 'hus',
        label: 'Hus',
        currentPolicyId: 'c1',
        offerPolicyId: 'o1',
      });
      expect(result.unmatchedCurrent).toHaveLength(0);
      expect(result.unmatchedOffer).toHaveLength(0);
    });
    
    it('should return unmatched when no type matches', () => {
      const current = [createMockPolicy('c1', 'hus')];
      const offers = [createMockPolicy('o1', 'bil')];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs).toHaveLength(0);
      expect(result.unmatchedCurrent).toEqual(['c1']);
      expect(result.unmatchedOffer).toEqual(['o1']);
    });
    
    it('should choose best match when multiple candidates exist', () => {
      const current = [
        createMockPolicy('c1', 'indbo', { insuredAddress: 'Kornvænget 123' }),
        createMockPolicy('c2', 'indbo', { insuredAddress: 'Nørregade 456' }),
      ];
      const offers = [
        createMockPolicy('o1', 'indbo', { address: 'Kornvænget 123' }),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0]).toMatchObject({
        currentPolicyId: 'c1',
        offerPolicyId: 'o1',
      });
      expect(result.unmatchedCurrent).toEqual(['c2']);
    });
    
    it('should score address match higher than no match', () => {
      const current = [
        createMockPolicy('c1', 'hus', { insuredAddress: 'Kornvænget 123' }),
        createMockPolicy('c2', 'hus', {}),
      ];
      const offers = [
        createMockPolicy('o1', 'hus', { address: 'Kornvænget 123' }),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs[0].currentPolicyId).toBe('c1');
    });
    
    it('should score person name match', () => {
      const current = [
        createMockPolicy('c1', 'ulykke', { personName: 'Hans Jensen' }),
        createMockPolicy('c2', 'ulykke', {}),
      ];
      const offers = [
        createMockPolicy('o1', 'ulykke', { insuredPerson: 'Hans Jensen' }),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs[0].currentPolicyId).toBe('c1');
    });
    
    it('should score offer number match', () => {
      const current = [
        createMockPolicy('c1', 'bil', { offerNumber: 'TRY-2024-12345' }),
        createMockPolicy('c2', 'bil', {}),
      ];
      const offers = [
        createMockPolicy('o1', 'bil', { tilbudsnummer: 'TRY-2024-12345' }),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs[0].currentPolicyId).toBe('c1');
    });
    
    it('should combine multiple scoring signals', () => {
      const current = [
        createMockPolicy('c1', 'hus', {
          insuredAddress: 'Kornvænget 123',
          personName: 'Hans Jensen',
        }),
        createMockPolicy('c2', 'hus', {
          insuredAddress: 'Kornvænget 123',
        }),
        createMockPolicy('c3', 'hus', {}),
      ];
      const offers = [
        createMockPolicy('o1', 'hus', {
          address: 'Kornvænget 123',
          insuredPerson: 'Hans Jensen',
        }),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs[0].currentPolicyId).toBe('c1');
      expect(result.unmatchedCurrent).toEqual(['c2', 'c3']);
    });
    
    it('should use stable sort for tie-breaking', () => {
      const current = [
        createMockPolicy('c-aaa', 'indbo'),
        createMockPolicy('c-zzz', 'indbo'),
      ];
      const offers = [
        createMockPolicy('o-zzz', 'indbo'),
        createMockPolicy('o-aaa', 'indbo'),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs).toHaveLength(2);
      expect(result.pairs[0].currentPolicyId).toBe('c-aaa');
      expect(result.pairs[0].offerPolicyId).toBe('o-aaa');
      expect(result.pairs[1].currentPolicyId).toBe('c-zzz');
      expect(result.pairs[1].offerPolicyId).toBe('o-zzz');
    });
    
    it('should match multiple policy types independently', () => {
      const current = [
        createMockPolicy('c1', 'hus'),
        createMockPolicy('c2', 'indbo'),
        createMockPolicy('c3', 'ulykke'),
      ];
      const offers = [
        createMockPolicy('o1', 'hus'),
        createMockPolicy('o2', 'indbo'),
        createMockPolicy('o3', 'bil'),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs).toHaveLength(2);
      expect(result.pairs.find(p => p.policyType === 'hus')).toBeDefined();
      expect(result.pairs.find(p => p.policyType === 'indbo')).toBeDefined();
      expect(result.unmatchedCurrent).toEqual(['c3']);
      expect(result.unmatchedOffer).toEqual(['o3']);
    });
    
    it('should handle empty inputs', () => {
      expect(computeBestMatches([], [])).toEqual({
        pairs: [],
        unmatchedCurrent: [],
        unmatchedOffer: [],
      });
      
      const current = [createMockPolicy('c1', 'hus')];
      expect(computeBestMatches(current, [])).toEqual({
        pairs: [],
        unmatchedCurrent: ['c1'],
        unmatchedOffer: [],
      });
      
      const offers = [createMockPolicy('o1', 'hus')];
      expect(computeBestMatches([], offers)).toEqual({
        pairs: [],
        unmatchedCurrent: [],
        unmatchedOffer: ['o1'],
      });
    });
    
    it('should normalize addresses case-insensitively', () => {
      const current = [
        createMockPolicy('c1', 'hus', { insuredAddress: 'KORNVÆNGET 123' }),
      ];
      const offers = [
        createMockPolicy('o1', 'hus', { address: 'kornvænget 123' }),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs).toHaveLength(1);
      expect(result.pairs[0].currentPolicyId).toBe('c1');
    });
    
    it('should leave policies unmatched when no identifying signals match (score = 0)', () => {
      const current = [
        createMockPolicy('c1', 'hus', {}),
        createMockPolicy('c2', 'hus', {}),
      ];
      const offers = [
        createMockPolicy('o1', 'hus', {}),
        createMockPolicy('o2', 'hus', {}),
      ];
      
      const result = computeBestMatches(current, offers);
      
      expect(result.pairs).toHaveLength(0);
      expect(result.unmatchedCurrent).toHaveLength(2);
      expect(result.unmatchedOffer).toHaveLength(2);
      expect(result.unmatchedCurrent).toContain('c1');
      expect(result.unmatchedCurrent).toContain('c2');
      expect(result.unmatchedOffer).toContain('o1');
      expect(result.unmatchedOffer).toContain('o2');
    });
  });
});
