export function formatNeverStarted(workflows: string[], graceMs: number): string {
  return (
    `Predicted workflow runs GitHub never started: ${JSON.stringify(workflows)}. ` +
    `Every other predicted run finished and nothing appeared for ${graceMs / 1000}s, ` +
    'so these are not late — GitHub created no run for them. Either the workflow ' +
    'is not receiving the events its triggers ask for, or the prediction is wrong ' +
    'to expect it to dispatch.'
  );
}
