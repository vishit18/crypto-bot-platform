import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "./api";

function formatUSD(value) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function StatusChip({ status }) {
  const base = "text-xs px-2 py-1 rounded-md border w-fit";
  const map = {
    pending: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
    bought: "bg-blue-500/10 text-blue-300 border-blue-500/20",
    sold: "bg-green-500/10 text-green-300 border-green-500/20",
    stopped: "bg-red-500/10 text-red-300 border-red-500/20",
  };
  const cls = map[status] || "bg-gray-500/10 text-gray-200 border-gray-500/20";
  return <span className={`${base} ${cls}`}>{String(status).toUpperCase()}</span>;
}

export default function App() {
  const [priceData, setPriceData] = useState(null);

  const [activeTrades, setActiveTrades] = useState([]);
  const [historyTrades, setHistoryTrades] = useState([]);

  const [selectedTradeId, setSelectedTradeId] = useState(null);
  const [logs, setLogs] = useState([]);

  // Trade form state
  const [form, setForm] = useState({
    symbol: "BTC/USDT",
    buy_price: "",
    sell_price: "",
    stop_loss: "",
    quantity: "0.1",
  });

  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  // --- Poll price + active trades + history ---
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [p, a, h] = await Promise.all([
          apiGet("/price/live"),
          apiGet("/trade/active"),
          apiGet("/trade/history"),
        ]);

        setPriceData(p);
        setActiveTrades(a);
        setHistoryTrades(h);

        if (!selectedTradeId && a.length > 0) {
          setSelectedTradeId(a[0].id);
        }

        // If selected trade moved out of active (sold/stopped), auto-select first active
        if (selectedTradeId && a.length > 0) {
          const stillActive = a.some((t) => t.id === selectedTradeId);
          if (!stillActive) setSelectedTradeId(a[0].id);
        }

        // If there are no active trades, clear selection + logs
        if (a.length === 0) {
          setSelectedTradeId(null);
          setLogs([]);
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTradeId]);

  // --- Poll logs for selected trade ---
  useEffect(() => {
    const fetchLogs = async () => {
      if (!selectedTradeId) {
        setLogs([]);
        return;
      }
      try {
        const data = await apiGet(`/trade/${selectedTradeId}/logs`);
        setLogs(data);
      } catch (e) {
        console.error(e);
      }
    };

    fetchLogs();
    const id = setInterval(fetchLogs, 3000);
    return () => clearInterval(id);
  }, [selectedTradeId]);

  const todayChange = useMemo(() => {
    if (!priceData) return null;
    const c = priceData.change_24h;
    const pct = priceData.change_percent_24h;
    if (c === null || pct === null || c === undefined || pct === undefined) return null;
    const dir = c > 0 ? "up" : c < 0 ? "down" : "flat";
    return { c, pct, dir };
  }, [priceData]);

  const dayColor =
    todayChange?.dir === "up"
      ? "text-green-400"
      : todayChange?.dir === "down"
      ? "text-red-400"
      : "text-gray-400";

  const dayArrow =
    todayChange?.dir === "up" ? "▲" : todayChange?.dir === "down" ? "▼" : "•";

  const currentPrice = priceData?.price ? Number(priceData.price) : null;

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitTrade = async () => {
    setFormError(null);
    setFormSuccess(null);

    try {
      const payload = {
        symbol: form.symbol,
        buy_price: Number(form.buy_price),
        sell_price: Number(form.sell_price),
        stop_loss: Number(form.stop_loss),
        quantity: Number(form.quantity),
        user_id: 1,
      };

      // Basic validation
      if (
        !payload.symbol ||
        !Number.isFinite(payload.buy_price) ||
        !Number.isFinite(payload.sell_price) ||
        !Number.isFinite(payload.stop_loss) ||
        !Number.isFinite(payload.quantity)
      ) {
        setFormError("Please fill all fields with valid numbers.");
        return;
      }

      if (payload.quantity <= 0) {
        setFormError("Quantity must be > 0.");
        return;
      }

      // Reasonable trading rules (still allow edge cases, but guide user)
      if (payload.stop_loss >= payload.buy_price) {
        setFormError("Stop-loss should be below Buy Price.");
        return;
      }

      const res = await apiPost("/trade/create", payload);
      setFormSuccess(`Trade created (id: ${res.trade_id})`);

      // clear just the price fields to encourage next entry
      setForm((prev) => ({ ...prev, buy_price: "", sell_price: "", stop_loss: "" }));
    } catch (e) {
      setFormError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Crypto Bot Platform</h1>
          <div className="text-sm text-gray-400">Smart Polling • 3s</div>
        </div>

        {/* Top row */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Price card */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
            <div className="text-sm text-gray-400">BTC / USD</div>

            <div className="mt-2 text-3xl font-semibold text-green-400">
              {currentPrice ? `$${formatUSD(currentPrice)}` : "Loading..."}
            </div>

            <div className="mt-2 text-sm">
              {todayChange ? (
                <div className={dayColor}>
                  {dayArrow} 24h: {todayChange.c > 0 ? "+" : ""}
                  {formatUSD(todayChange.c)} ({todayChange.pct > 0 ? "+" : ""}
                  {Number(todayChange.pct).toFixed(2)}%)
                </div>
              ) : (
                <div className="text-gray-500">24h change: unavailable</div>
              )}
            </div>

            <div className="mt-3 text-xs text-gray-500">
              Price from CoinGecko • Cached to avoid rate limits
            </div>
          </div>

          {/* Trade form */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 lg:col-span-2">
            <div className="text-sm text-gray-400">Trade Setup</div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
              <select
                className="bg-black border border-zinc-700 rounded-lg p-2"
                value={form.symbol}
                onChange={(e) => handleChange("symbol", e.target.value)}
              >
                <option>BTC/USDT</option>
              </select>

              <input
                className="bg-black border border-zinc-700 rounded-lg p-2"
                placeholder="Buy Price"
                value={form.buy_price}
                onChange={(e) => handleChange("buy_price", e.target.value)}
              />
              <input
                className="bg-black border border-zinc-700 rounded-lg p-2"
                placeholder="Sell Price (Take Profit)"
                value={form.sell_price}
                onChange={(e) => handleChange("sell_price", e.target.value)}
              />
              <input
                className="bg-black border border-zinc-700 rounded-lg p-2"
                placeholder="Stop Loss"
                value={form.stop_loss}
                onChange={(e) => handleChange("stop_loss", e.target.value)}
              />
              <input
                className="bg-black border border-zinc-700 rounded-lg p-2"
                placeholder="Quantity"
                value={form.quantity}
                onChange={(e) => handleChange("quantity", e.target.value)}
              />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={submitTrade}
                className="bg-green-600 hover:bg-green-500 text-black font-semibold px-4 py-2 rounded-lg"
              >
                Submit Trade
              </button>

              {formError && <div className="text-red-400 text-sm">{formError}</div>}
              {formSuccess && <div className="text-green-400 text-sm">{formSuccess}</div>}
            </div>
          </div>
        </div>

        {/* Middle row */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Active trades */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 lg:col-span-2">
            <div className="text-sm text-gray-400">Active Trades</div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-400">
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2">ID</th>
                    <th className="text-left py-2">Symbol</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Buy</th>
                    <th className="text-left py-2">TP</th>
                    <th className="text-left py-2">SL</th>
                    <th className="text-left py-2">Unrealized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTrades.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/50 ${
                        selectedTradeId === t.id ? "bg-zinc-800/50" : ""
                      }`}
                      onClick={() => setSelectedTradeId(t.id)}
                    >
                      <td className="py-2">{t.id}</td>
                      <td className="py-2">{t.symbol}</td>
                      <td className="py-2">
                        <StatusChip status={t.status} />
                      </td>
                      <td className="py-2">{formatUSD(t.buy_price)}</td>
                      <td className="py-2">{formatUSD(t.sell_price)}</td>
                      <td className="py-2">{formatUSD(t.stop_loss)}</td>
                      <td
                        className={`py-2 ${
                          t.unrealized_pnl > 0
                            ? "text-green-400"
                            : t.unrealized_pnl < 0
                            ? "text-red-400"
                            : "text-gray-300"
                        }`}
                      >
                        {t.unrealized_pnl === null || t.unrealized_pnl === undefined
                          ? "-"
                          : formatUSD(t.unrealized_pnl)}
                      </td>
                    </tr>
                  ))}
                  {activeTrades.length === 0 && (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={7}>
                        No active trades
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Live logs */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5">
            <div className="text-sm text-gray-400">Live Logs</div>

            <div className="mt-3 h-72 overflow-auto space-y-2">
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="text-xs text-gray-300 border border-zinc-800 rounded-lg p-2"
                >
                  <div className="text-gray-400">
                    {new Date(l.timestamp).toLocaleTimeString()}
                  </div>
                  <div>{l.message}</div>
                  <div className="text-gray-500">Price: {formatUSD(l.price)}</div>
                </div>
              ))}

              {!selectedTradeId && (
                <div className="text-gray-500 text-sm">Select a trade to view logs</div>
              )}
              {selectedTradeId && logs.length === 0 && (
                <div className="text-gray-500 text-sm">No logs yet</div>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        <div className="mt-6 rounded-xl bg-zinc-900 border border-zinc-800 p-5">
          <div className="text-sm text-gray-400">Trade History</div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-400">
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2">ID</th>
                  <th className="text-left py-2">Symbol</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Buy</th>
                  <th className="text-left py-2">Exit</th>
                  <th className="text-left py-2">Realized P&L</th>
                  <th className="text-left py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {historyTrades.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-800">
                    <td className="py-2">{t.id}</td>
                    <td className="py-2">{t.symbol}</td>
                    <td className="py-2">
                      <StatusChip status={t.status} />
                    </td>
                    <td className="py-2">{formatUSD(t.buy_price)}</td>
                    <td className="py-2">
                      {t.exit_price !== null ? formatUSD(t.exit_price) : "-"}
                    </td>
                    <td
                      className={`py-2 ${
                        t.pnl > 0 ? "text-green-400" : t.pnl < 0 ? "text-red-400" : "text-gray-300"
                      }`}
                    >
                      {t.pnl !== null ? formatUSD(t.pnl) : "-"}
                    </td>
                    <td className="py-2 text-gray-400">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {historyTrades.length === 0 && (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={7}>
                      No completed trades yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
