/**
 * Catalog wallets store a book value (invested + a stale return) that no longer
 * matches position marks, and they copy that return into `available_balance`.
 * Weights computed against the book then exceed 100% (crypto 102% on the main
 * portfolio). Recompute marks, returns, and weights from quantity × price.
 */

export interface ReconcilableAsset {
  amount: number
  average_price: number
  current_price: number
  current_value: number
  return_amount: number
  return_percentage: number
  allocation_percentage: number
}

export interface ReconcilableWallet {
  total_value: number
  available_balance: number
  invested_amount: number
  total_return: number
  total_return_percentage: number
  assets: ReconcilableAsset[]
}

export function reconcileWallet(wallet: ReconcilableWallet): void {
  let holdings = 0
  let invested = 0

  for (const asset of wallet.assets) {
    const mark = asset.amount * asset.current_price
    const cost = asset.amount * asset.average_price
    asset.current_value = mark
    asset.return_amount = mark - cost
    asset.return_percentage = cost > 0 ? (asset.return_amount / cost) * 100 : 0
    holdings += mark
    invested += cost
  }

  const cash = cashThatFitsBook(wallet, holdings)
  const total = holdings + cash

  wallet.available_balance = cash
  wallet.invested_amount = invested
  wallet.total_return = holdings - invested
  wallet.total_return_percentage = invested > 0 ? (wallet.total_return / invested) * 100 : 0
  wallet.total_value = total

  for (const asset of wallet.assets) {
    asset.allocation_percentage = total > 0 ? (asset.current_value / total) * 100 : 0
  }
}

/**
 * Keep cash only when holdings + cash still fit inside the stated book.
 * When marks have outgrown the book, `available_balance` is the stale return
 * figure, not spendable fiat — counting it would push the pie back over 100%.
 */
function cashThatFitsBook(wallet: ReconcilableWallet, holdings: number): number {
  const cash = Math.max(0, wallet.available_balance)
  if (holdings + cash <= wallet.total_value + 1) return cash
  return 0
}
