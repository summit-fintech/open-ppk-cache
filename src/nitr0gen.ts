import { ActiveRequest } from "@activeledger/activeutilities";
import { ActiveLogger } from "@activeledger/activelogger";
import { IBaseTransaction, IKey, TransactionHandler } from "@activeledger/sdk";
import { Token } from "./mongo"; // TODO : Resolve, CopyCode

export interface ExtendedIKey extends IKey {
  uuid: string;
}

export interface Wallet {
  symbol: string;
  nId: string;
  address: string;
  nonce: number;
  chainId: number;
  hashes: string[];
  tokens: Token[];
  amount?: any;
  hidden?: boolean;
}

/**
 * Below is a mish mash of OTK Servier and Nitr0gen API classes
 * TODO : Also duplicate code as the Mongo class to fix
 *
 * @class Nitr0genService
 */
export class Nitr0genService {

  /**
   * Create wallet process
   *
   * @static
   * @param {string} symbol
   * @param {ExtendedIKey} otk
   * @returns {Promise<Wallet>}
   * @memberof Nitr0genService
   */
  public static async createWallet(
    symbol: string,
    otk: ExtendedIKey
  ): Promise<Wallet> {
    if (otk.identity) {
      let results = await this.add(
        symbol,
        otk.identity,
        await this.keyCreate(symbol, otk),
        otk.uuid
      );

      ActiveLogger.info(`Verifying ${symbol.toUpperCase()} Wallet Integrity`);

      await this.diffConsensus(
        await this.diffConsensusTx(
          results.key.nId,
          results.key.address,
          results.hashes,
          otk
        ),
        otk.uuid
      );

      return {
        symbol,
        nId: results.key.nId,
        address: results.key.address,
        hashes: results.hashes,
        nonce: 0,
        chainId: results.chainId,
        tokens: results.tokens,
        //  tokens,
      };
    } else {
      throw Error("something went wrong");
    }
  }

  /**
   * Triggers the process to generate a new secured key without an owner
   *
   * @static
   * @param {string} symbol
   * @param {string} nId
   * @param {IBaseTransaction} ntx
   * @param {string} uuid
   * @returns {Promise<any>}
   * @memberof Nitr0genService
   */
  public static async add(
    symbol: string,
    nId: string,
    ntx: IBaseTransaction,
    uuid: string
  ): Promise<any> {
    try {
      return (
        await ActiveRequest.send(
          `${process.env.SERVERURL}/wallet/cache`,
          "POST",
          [`x-api-uuid: ${uuid}`],
          {
            key: {
              symbol,
              nId,
              seeded: true,
            },
            ntx,
          }
        )
      ).data;
    } catch (e) {
      ActiveLogger.error(e, "Add Error Happened");
      process.exit();
    }
  }

  /**
   * Differential Consensus confirmation that the key is secure
   *
   * @static
   * @param {IBaseTransaction} ntx
   * @param {string} uuid
   * @returns {Promise<any>}
   * @memberof Nitr0genService
   */
  public static async diffConsensus(
    ntx: IBaseTransaction,
    uuid: string
  ): Promise<any> {
    try {
      return (
        await ActiveRequest.send(
          `${process.env.SERVERURL}/wallet/cache/diffconsensus`,
          "POST",
          [`x-api-uuid: ${uuid}`],
          {
            notaTx:ntx,
          }
        )
      ).data;
    } catch (e) {
      ActiveLogger.error(e, "Diff Error Happened");
      process.exit();
    }
  }

  /**
   * Create the new profile OTK
   *
   * @static
   * @param {string} otpk
   * @param {IBaseTransaction} ntx
   * @param {string} uuid
   * @returns
   * @memberof Nitr0genService
   */
  public static async create(
    otpk: string,
    ntx: IBaseTransaction,
    uuid: string
  ) {
    try {
      return (
        await ActiveRequest.send(
          `${process.env.SERVERURL}/otk`,
          "POST",
          [`x-api-uuid: ${uuid}`],
          {
            otpk,
            ntx,
          }
        )
      ).data;
    } catch (e) {
      ActiveLogger.error(e, "Create Error Happened");
      process.exit();
    }
  }

  /**
   * Key create transaction for Activeledger
   *
   * @private
   * @static
   * @param {string} symbol
   * @param {IKey} key
   * @returns {Promise<IBaseTransaction>}
   * @memberof Nitr0genService
   */
  private static async keyCreate(
    symbol: string,
    key: IKey
  ): Promise<IBaseTransaction> {
    const txHandler = new TransactionHandler();

    // Build Transaction
    const txBody: IBaseTransaction = {
      $tx: {
        $namespace: Nitr0gen.Namespace,
        $contract: Nitr0gen.OpenCreate,
        $i: {
          owner: {
            $stream: key.identity,
            symbol,
          },
        },
      },
      $sigs: {},
      $selfsign: false,
    };

    // Sign Transaction & Send
    return await txHandler.signTransaction(txBody, key);
  }

  /**
   * Create the differential consensus transaction for Activeledger
   *
   * @private
   * @static
   * @param {string} nId
   * @param {string} address
   * @param {string[]} hashes
   * @param {IKey} key
   * @returns {Promise<IBaseTransaction>}
   * @memberof Nitr0genService
   */
  private static async diffConsensusTx(
    nId: string,
    address: string,
    hashes: string[],
    key: IKey
  ): Promise<IBaseTransaction> {
    const txHandler = new TransactionHandler();

    // Build Transaction
    const txBody: IBaseTransaction = {
      $tx: {
        $namespace: Nitr0gen.Namespace,
        $contract: Nitr0gen.DiffConsensus,
        $i: {
          owner: {
            $stream: key.identity,
            address,
            hashes,
          },
        },
        $o: {
          key: {
            $stream: nId,
          },
        },
      },
      $sigs: {},
      $selfsign: false,
    };

    // Sign Transaction & Send
    return await txHandler.signTransaction(txBody, key);
  }

  /**
   * Onboard new profile / otk into Activeledger
   *
   * @static
   * @param {ExtendedIKey} key
   * @returns {Promise<IBaseTransaction>}
   * @memberof Nitr0genService
   */
  public static async onboard(key: ExtendedIKey): Promise<IBaseTransaction> {
    const txHandler = new TransactionHandler();

    // Build Transaction
    const txBody: IBaseTransaction = {
      $tx: {
        $namespace: Nitr0gen.Namespace,
        $contract: Nitr0gen.Onboard,
        $i: {
          otk: {
            publicKey: key.key.pub.pkcs8pem,
            type: key.type,
            uuid: key.uuid,
          },
        },
      },
      $sigs: {},
      $selfsign: true,
    };

    // Sign Transaction & Send
    return await txHandler.signTransaction(txBody, key);
  }
}

/**
 * Contract Locations
 *
 * @enum {number}
 */
enum Nitr0gen {
  Namespace = "notabox.keys",
  Onboard = "df9e4e242c58cc6a03ca1679f007c7a04cad72c97fdb74bdfe9a4e1688077a79",
  Create = "c278818b9f10d5f18381a711827e344d583f7ecf446cdfb4b92016b308838a72",
  OpenCreate = "a79a09ed05e377060e823e3304a349b4d7f10978fb4f500b08243cd3ef8c96f3",
  CloseClaim = "95191594af0ac9c197f0719bfce8d7f8788ef45e40133b841df3e143f4992cde",
  DiffConsensus = "a9711259f9c0322c6eb1cca4c0baf1b460266be79c5c0f78cf1602a8476e0744",
  Preflight = "2a43dc59d4cfa0f8a5ad143247db41dd6524cc9e1a18fd7a00f14d0ca7bbac62",
  Sign = "f155dee677c1c2d661715d6b99e976f54534ae92bc6b73f5483e0ba08ea4f78b",
}
