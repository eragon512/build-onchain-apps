/**
 * @jest-environment jsdom
 */
import { renderHook } from '@testing-library/react';
import { useContractRead } from 'wagmi';
import OnchainProviders from '../../src/providers/OnchainProviders';
import { useCollectionMetadata } from './useCollectionMetadata';

jest.mock('wagmi', () => ({
  ...jest.requireActual<typeof import('wagmi')>('wagmi'),
  useContractRead: jest.fn(() => ({ data: {} })),
}));

describe('useCollectionMetadata', () => {
  it('should return with error', async () => {
    const mockHash = '0xMockHash';
    (useContractRead as jest.Mock).mockImplementation(() => ({ data: null }));
    const { result } = renderHook(() => useCollectionMetadata(true, mockHash, []), { wrapper: OnchainProviders });
    
    expect(result.current).toEqual({
      collectionName: null,
      description: null,
      imageAddress: null,
      error: new Error('useCollectionMetadata: No contractURI found'),
      status: 'error',
    })
  });
});
