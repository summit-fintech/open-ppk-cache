import { randomUUID } from "crypto";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { KeyType, KeyHandler } from "@activeledger/sdk";
import { ActiveLogger } from "@activeledger/activelogger";
import { Mongo } from "./mongo"; // TODO : Resolve, CopyCode
import { Nitr0genService, ExtendedIKey } from "./nitr0gen";
import * as dotenv from "dotenv";

interface Profile {
  otk: ExtendedIKey;
}

// Setup Runtime Env
// SERVERURL=
// MONGODB_CONNECTION_STRING
// MONGODB_DATABASE
dotenv.config();

// Local runtime cache of keys
const profilePath = `${process.cwd()}/${
  process.env.profile || ".summit.profile"
}`;

// Create this many keys per run (*2 for live networks)
const createSoMany = 5;

// Support blockchain types
const supportedSymbols = ["eth", "bnb", "trx", "btc"];
const supportedTestSymbols = ["tbtc", "ropsten", "tbnb", "niles"];

// Extracted keys from profilePath
let otk: ExtendedIKey;

// Startup type
if (existsSync(profilePath)) {
  // Boot up
  boot();
} else {
  // Create Profile and run again
  create();
}

/**
 * Boot the key caching process
 *
 */
async function boot() {
  // Don't need password this key won't be able to do much. It will request new keys that are open.
  // Even if this is hijacked and they request a closed key it would only be attached to this key!
  otk = (JSON.parse(readFileSync(profilePath).toString()) as Profile).otk;

  await Mongo.init(
    process.env.MONGODB_CONNECTION_STRING as string,
    process.env.MONGODB_DATABASE as string
  );

  // Startup check, then use intervals. (Could also watch the local database)
  await checkAll();
  setInterval(async () => {
    await checkAll();
  }, 30000);
}

/**
 * Single entry point to run all key type creations
 *
 */
async function checkAll() {
  for (let i = 0; i < supportedSymbols.length; i++) {
    await checkNdCreate(supportedSymbols[i], createSoMany * 2);
  }

  for (let i = 0; i < supportedTestSymbols.length; i++) {
    await checkNdCreate(supportedTestSymbols[i], createSoMany);
  }
}

/**
 * Check a specific key supply and adds more if needed.
 *
 * @param {string} symbol
 * @param {number} total
 */
async function checkNdCreate(symbol: string, total: number) {
  ActiveLogger.info(`Checking ${symbol} Keys`);

  // Find empty keys of type
  let totalEmptyKeys = Mongo.collKey.find({
    userId: undefined,
    symbol: symbol.toLowerCase(),
  });

  if ((await totalEmptyKeys.count()) < total) {
    ActiveLogger.info(`Creating ${total} new ${symbol} keys`);

    // Create X amount of new keys as running low
    for (let i = 0; i < total; i++) {
      ActiveLogger.info(`Creating ${i} of ${total} ${symbol} keys`);
      let wallet = await Nitr0genService.createWallet(
        symbol.toLowerCase(),
        otk
      );
      ActiveLogger.info(`Wallet ${wallet.address} has been created`);
    }
  }
}

/**
 * Create local profile so boot can run
 *
 */
async function create() {
  // Create key
  ActiveLogger.info("Generating new OTK");
  const keyHandler = new KeyHandler();
  otk = (await keyHandler.generateKey(
    "otk",
    KeyType.EllipticCurve
  )) as ExtendedIKey;
  otk.uuid = randomUUID();
  ActiveLogger.info("OTK Needs Onboarding");

  const result = (await Nitr0genService.create(
    otk.key.pub.pkcs8pem,
    await Nitr0genService.onboard(otk),
    otk.uuid
  )) as any;

  result.nId = result.notaId;
  if (result.nId) {
    otk.identity = result.nId;

    writeFileSync(
      profilePath,
      JSON.stringify({
        otk,
      })
    );
    ActiveLogger.info("Restarting....");
    boot();
  }
}
