import { hasQortalBridge, requestQortal } from '../utils/qortalClient';
import { APP_QORTAL_NAME } from '../utils/siteConfig';

export const SUPPORT_ROUTE = '/support';
export const SUPPORT_LABEL = 'By Me a Pizza';
export const MIN_PIZZA_AMOUNT = 1;

let paymentInProgress = false;

export const parsePizzaAmount = (value) => {
  const decimal = String(value).trim().replace(',', '.');
  if (!/^\d+(?:\.\d{1,8})?$/.test(decimal)) return null;
  const amount = Number(decimal);
  return amount >= MIN_PIZZA_AMOUNT && Number.isSafeInteger(Math.round(amount * 100_000_000))
    ? amount
    : null;
};

export const sendPizzaSupport = async (value) => {
  const amount = parsePizzaAmount(value);
  if (amount === null) throw new Error('Enter at least 1 QORT, with up to eight decimal places.');
  if (!hasQortalBridge()) throw new Error('Open this app in Qortal to send a pizza.');
  if (paymentInProgress) throw new Error('A pizza payment is already open in your wallet.');

  paymentInProgress = true;
  try {
    const nameData = await requestQortal({ action: 'GET_NAME_DATA', name: APP_QORTAL_NAME });
    const recipient = nameData?.owner;
    if (typeof recipient !== 'string' || !/^Q[1-9A-HJ-NP-Za-km-z]{33}$/.test(recipient)) {
      throw new Error('Could not find the app publisher’s Qortal address.');
    }

    const receipt = await requestQortal({ action: 'SEND_COIN', coin: 'QORT', recipient, amount });
    if (receipt?.error) throw new Error(receipt.message || String(receipt.error));
    if (typeof receipt?.signature !== 'string' || !receipt.signature.trim()) {
      throw new Error('The wallet returned no receipt. Check your wallet history before trying again.');
    }
    return { amount, signature: receipt.signature };
  } finally {
    paymentInProgress = false;
  }
};
