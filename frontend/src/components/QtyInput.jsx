import { canSplit, fmtQty, toStrips } from "../lib/api";

export const QtyInput = ({ med, unit, qty, onChange, testid, className = "" }) => {
  const split = canSplit(med);
  const u = split ? unit : "strip";
  return (
    <div className={`flex gap-1 items-center ${className}`}>
      {split && (
        <select data-testid={`${testid}-unit`} value={u} onChange={(e) => onChange({ unit: e.target.value, qty })}
          className="px-1.5 py-2 border border-slate-200 rounded-lg bg-white text-xs" title="Give by strip or by tablet">
          <option value="strip">Strip</option>
          <option value="tab">Tab</option>
        </select>
      )}
      <input data-testid={testid} type="number" min="0" step={u === "tab" ? "1" : "any"} value={qty}
        onChange={(e) => onChange({ unit: u, qty: e.target.value })} title={u === "tab" ? "Number of tablets" : "Quantity"}
        className="w-full min-w-0 px-2 py-2 border border-slate-200 rounded-lg bg-white" />
      {split && u === "tab" && Number(qty) > 0 && (
        <span className="text-[10px] text-slate-500 whitespace-nowrap" data-testid={`${testid}-strips`}>= {fmtQty(toStrips(med, u, qty))} strip</span>
      )}
    </div>
  );
};

export const qtyPayload = (med, unit, qty) => {
  const tab = unit === "tab" && canSplit(med);
  return { quantity: toStrips(med, unit, qty), tablets: tab ? Math.round(Number(qty)) : null };
};
