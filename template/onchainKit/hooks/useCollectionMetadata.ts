import { useEffect, useState } from 'react';
import { Abi, Address } from 'abitype';
import { useReadContract } from 'wagmi';
import { ipfsToHTTP } from '../core/ipfs';

/**
 * There is some differences in URI standards between ERC721 and 1155, handle those in this component.
 */
enum UriFunctionType {
  uri = 'uri',
  contractURI = 'contractURI',
}

type CollectionMetadataResult =
  | {
      collectionName: null;
      description: null;
      imageAddress: null;
      status: 'loading';
    }
  | {
      collectionName: null;
      description: null;
      imageAddress: null;
      error: Error;
      status: 'error';
    }
  | {
      collectionName: string;
      description: string;
      imageAddress: string;
      status: 'success';
    };

type JsonMetadata = {
  name: string;
  description: string;
  image: string;
};

function tryParseMetadataJson(str: string): CollectionMetadataResult | undefined {
  try {
    const json = JSON.parse(str) as JsonMetadata;
    return {
      collectionName: json.name,
      description: json.description,
      imageAddress: ipfsToHTTP(json.image),
      status: 'success',
    } as CollectionMetadataResult;
  } catch (err) {
    return {
      error: err,
      status: 'error',
    } as CollectionMetadataResult;
  }
}

async function fetchCollectionMetadata(contractURI: unknown): Promise<CollectionMetadataResult> {
  /**
   * Contract URIs can either be hosted externally (e.g. IPFS) or stored as data within the contract itself as json.
   * While this is not defined in https://datatracker.ietf.org/doc/html/rfc3986#section-1.1.2 it is a common
   * practice out in the wild.
   */
  const jsonParsedMetadata = tryParseMetadataJson(contractURI as string);
  if (jsonParsedMetadata) {
    return jsonParsedMetadata;
  } else {
    const response = await fetch(contractURI as URL);
    const json = (await response.json()) as { name: string; description: string; image: string };
    return {
      collectionName: json.name,
      description: json.description,
      imageAddress: ipfsToHTTP(json.image),
      status: 'success',
    };
  }
}

/**
 * @param enabled Whether the app is in a state where contracts can be queried.
 * @param address Address for the contract
 * @param abi ABI for the contract
 * @param lookupType Lookup type to use for the contract URI function
 * TODO: standardize once https://github.com/ethereum/ERCs/pull/150 is settled
 * @returns CollectionMetadataResult
 */
export function useCollectionMetadata(enabled: boolean, address: Address | undefined, abi: Abi) {
  const [result, setResult] = useState<CollectionMetadataResult>({
    collectionName: null,
    description: null,
    imageAddress: null,
    status: 'loading',
  });
  let lookupType: UriFunctionType;
  //TODO: kinds of a hack, is there a more prescriptive way we can do this lookup?
  if (JSON.stringify(abi).includes('contractURI')) {
    lookupType = UriFunctionType.contractURI;
  } else {
    lookupType = UriFunctionType.uri;
  }
  // In this case the contract URI is already HTTPS. A production-ready
  // solution would check the protocol and transform if necessary.
  const { data: contractURI } = useReadContract({
    // TODO: the chainId should be dynamic
    address,
    abi,
    functionName: lookupType.toString(),
    // TODO: We should not hack a specific token here
    args: lookupType === UriFunctionType.uri ? [BigInt(1)] : undefined,
    query: {
      enabled,
    },
  });

  useEffect(() => {
    if (contractURI) {
      fetchCollectionMetadata(contractURI)
        .then((res) => setResult(res))
        .catch((err: Error) => {
          console.error(err);
          setResult({
            collectionName: null,
            description: null,
            imageAddress: null,
            error: err,
            status: 'error',
          });
        });
    } else {
      setResult({
        collectionName: null,
        description: null,
        imageAddress: null,
        error: new Error('useCollectionMetadata: No contractURI found'),
        status: 'error',
      });
    }
  }, [contractURI]);

  return result;
}
