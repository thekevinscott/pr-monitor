/** Shared by the step walk and by the pre-scan that picks the tree provider. */
export function isCheckout(uses: string): boolean {
  return /^actions\/checkout@/.test(uses);
}
