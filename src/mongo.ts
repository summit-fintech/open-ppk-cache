import { MongoClient, Collection, Db } from "mongodb";

export interface User {
  _id?: string;
  nId: string;
  uuid: string;
  pnt: string;
  email: string;
  telephone: string;
  recovery: string;
  security: any;
  pairing: any;
  otpk: string[];
  lastOtpk: string;
  promotions: string[];
  promoTracking: {
    [index: string]: {
      history: any;
    };
  };
  created: Date;
  updated: Date;
}

export interface Key {
  _id?: string;
  userId: string;
  nId: string;
  symbol: string;
  address: string;
  chainId: number;
  hashes: string[];
  tolens: Token[];
  created: Date;
  updated: Date;
}

export interface Token {
  decimal?: number;
  balance?: number;
  name: string;
  contract: string;
  symbol: string;
  network: string;
}

/**
 * Mongo DB Connection Manager
 *
 * @export
 * @class Mongo
 */
export class Mongo {
  /**
   * Collection for Users
   *
   * @static
   * @type {Collection<any>}
   * @memberof Mongo
   */
  public static collUser: Collection<User>;

  /**
   * Collection for Keys
   *
   * @static
   * @type {Collection<any>}
   * @memberof Mongo
   */
  public static collKey: Collection<Key>;

  /**
   * Holds Client Object to Mongo
   *
   * @private
   * @static
   * @type {MongoClient}
   * @memberof Mongo
   */
  private static client: MongoClient;

  /**
   *  Holds open database reference
   *
   * @private
   * @static
   * @type {Db}
   * @memberof Mongo
   */
  private static db: Db;

  /**
   * Initialise Global Connection
   *
   * @static
   * @param {string} connectionUrl localhost:27017
   * @memberof Mongo
   */
  public static async init(connectionUrl: string, database: string) {
    if (!Mongo.client) {
      Mongo.client = await MongoClient.connect(connectionUrl);

      Mongo.db = Mongo.client.db(database);
      Mongo.collUser = Mongo.db.collection("user");
      Mongo.collKey = Mongo.db.collection("key");
    }
  }
}
