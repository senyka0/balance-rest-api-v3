import { Injectable } from '@nestjs/common';
import Web3 from 'web3';
import axios from 'axios';
import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from 'ethereum-multicall';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import tokenAbi from './constants/tokenAbi.json';
dotenv.config({ path: resolve(__dirname, '../.env') });

const web3 = new Web3(
  (process.env.INFURA_KEY as string) || 'https://mainnet.infura.io/v3/',
);
const multicall = new Multicall({ web3Instance: web3, tryAggregate: true });

@Injectable()
export class AppService {
  async getBalance(address: string): Promise<{
    address: string;
    ethBalance: number;
    erc20Balance: {
      name: string;
      symbol: string;
      balance: number;
      decimals: number;
    }[];
  }> {
    const ethBalance = parseInt(await web3.eth.getBalance(address));

    const tokens = await axios
      .get(
        'https://pro-api.coinmarketcap.com/v1/cryptocurrency/map?sort=cmc_rank',
        {
          headers: {
            'content-type': 'application/json',
            'X-CMC_PRO_API_KEY': process.env.X_CMC_PRO_API_KEY as string,
          },
        },
      )
      .then((res) =>
        res.data.data.filter(
          (token) =>
            token.platform?.slug === 'ethereum' &&
            token.platform?.token_address.length === 42,
        ),
      )
      .then((res) =>
        res.map((token) => {
          return {
            symbol: token.symbol,
            name: token.name,
            address: token.platform?.token_address,
          };
        }),
      );

    const contractCallContext: ContractCallContext[] = tokens
      .slice(0, 100)
      .map((token) => {
        return {
          reference: token.address,
          contractAddress: token.address,
          abi: tokenAbi,
          calls: [
            {
              reference: 'balanceOf',
              methodName: 'balanceOf',
              methodParameters: [address],
            },
            {
              reference: 'decimals',
              methodName: 'decimals',
              methodParameters: [],
            },
          ],
        };
      });

    const results: ContractCallResults = await multicall.call(
      contractCallContext,
    );

    const erc20Balance = tokens
      .slice(0, 100)
      .filter(
        (token) =>
          results.results[token.address].callsReturnContext[0].success === true,
      )
      .map((token) => {
        return {
          symbol: token.symbol,
          name: token.name,
          address: token.address,
          balance: parseInt(
            results.results[
              token.address
            ].callsReturnContext[0].returnValues[0].hex.toString(),
          ),
          decimals:
            results.results[token.address].callsReturnContext[1]
              .returnValues[0],
        };
      })
      .filter((token) => token.balance > 0);

    return { address, ethBalance, erc20Balance };
  }
}
