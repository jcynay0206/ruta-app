import React, { useState, useEffect } from "react";
import {
  Navigation, LayoutGrid, Users, FileText, BarChart3, Bell, Search,
  MapPin, Clock, Check, X, TrendingUp, TrendingDown, Package, DollarSign,
  MoreVertical, Circle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const SUPABASE_URL = "https://zvuoxvvauxfluhimylfz.supabase.co";
const SUPABASE_KEY = "sb_publishable_66RQoNajgb8VjMLKcj6mwA_Yf_QlRwg";
const sbHeaders = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function sb(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Error cargando ${path}`);
  return res.json();
}

const WEEKDAY_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const STATUS_STYLE = {
  "en ruta":       "text-[#FF9E2C] bg-[#FF9E2C]/10 border-[#FF9E2C]/30",
  "completado":    "text-[#33C17A] bg-[#33C17A]/10 border-[#33C17A]/30",
  "sin iniciar":   "text-[#8B93A3] bg-[#8B93A3]/10 border-[#8B93A3]/30",
  "retrasado":     "text-[#E5484D] bg-[#E5484D]/10 border-[#E5484D]/30",
  "pagado":        "text-[#33C17A] bg-[#33C17A]/10 border-[#33C17A]/30",
  "pendiente":     "text-[#FF9E2C] bg-[#FF9E2C]/10 border-[#FF9E2C]/30",
  "vencido":       "text-[#E5484D] bg-[#E5484D]/10 border-[#E5484D]/30",
};

function Pill({ label }) {
  return (
    <span className={`text-[10.5px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 ${STATUS_STYLE[label]}`}>
      {label}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, delta, positive }) {
  return (
    <div className="bg-[#1C2127] border border-[#2A303B] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#242A34] flex items-center justify-center">
          <Icon size={15} className="text-[#FF9E2C]" />
        </div>
        {delta && (
          <span className={`flex items-center gap-1 text-[11.5px] font-semibold ${positive ? "text-[#33C17A]" : "text-[#E5484D]"}`}>
            {positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {delta}
          </span>
        )}
      </div>
      <p className="text-[22px] font-bold text-[#F2EFE9] leading-none">{value}</p>
      <p className="text-[12px] text-[#8B93A3] mt-1.5">{label}</p>
    </div>
  );
}

const NAV = [
  { key: "resumen", label: "Resumen", icon: LayoutGrid },
  { key: "conductores", label: "Conductores", icon: Users },
  { key: "facturacion", label: "Facturación", icon: FileText },
  { key: "reportes", label: "Reportes", icon: BarChart3 },
];

export default function AgencyDashboard() {
  const [tab, setTab] = useState("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [agency, setAgency] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [invoices, setInvoices] = useState([]);

  useEffect(() => {
    async function load() {
      try {
        const [agencies, driverRows, deliveryRows, invoiceRows] = await Promise.all([
          sb("agencies?select=*&limit=1"),
          sb("drivers?select=*"),
          sb("deliveries?select=*"),
          sb("invoices?select=*&order=due_date.asc"),
        ]);
        setAgency(agencies[0] || null);
        setDrivers(driverRows);
        setDeliveries(deliveryRows);
        setInvoices(invoiceRows);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const driverRows = drivers.map((d) => {
    const own = deliveries.filter((x) => x.driver_id === d.id);
    const done = own.filter((x) => x.status === "entregado").length;
    const failed = own.filter((x) => x.status === "fallido").length;
    let status = "sin iniciar";
    if (failed > 0) status = "retrasado";
    else if (own.length > 0 && done === own.length) status = "completado";
    else if (own.some((x) => x.status === "en_camino" || x.status === "entregado")) status = "en ruta";
    const remaining = own.find((x) => x.status === "en_camino" || x.status === "pendiente");
    return { id: d.id, name: d.name, vehicle: d.vehicle, stops: own.length, done, status, eta: remaining ? "En progreso" : "—" };
  });

  const invoiceRows = invoices.map((inv) => ({
    id: inv.id,
    name: agency?.name || "Cliente",
    plan: inv.period,
    amount: `$${Number(inv.amount).toFixed(2)}`,
    status: inv.status,
    date: new Date(inv.due_date).toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
  }));

  const deliveredCount = deliveries.filter((d) => d.status === "entregado").length;
  const failedCount = deliveries.filter((d) => d.status === "fallido").length;
  const activeDrivers = driverRows.filter((d) => d.status !== "sin iniciar").length;
  const revenue = invoices.filter((i) => i.status === "pagado").reduce((s, i) => s + Number(i.amount), 0);

  const chartMap = {};
  deliveries.forEach((d) => {
    const day = WEEKDAY_LABEL[new Date(d.created_at).getDay()];
    chartMap[day] = (chartMap[day] || 0) + 1;
  });
  const weekData = WEEKDAY_LABEL.map((day) => ({ day, entregas: chartMap[day] || 0 }));

  if (loading) {
    return (
      <div className="h-full w-full bg-[#14171C] flex items-center justify-center text-[#8B93A3] text-[13px]">
        Cargando datos de Supabase…
      </div>
    );
  }
  if (error) {
    return (
      <div className="h-full w-full bg-[#14171C] flex items-center justify-center text-[#E5484D] text-[13px] px-8 text-center">
        No se pudo conectar a Supabase: {error}
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#14171C] flex text-[#F2EFE9] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[210px] shrink-0 border-r border-[#2A303B] flex flex-col py-5 px-3">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-7 h-7 rounded-md bg-[#FF9E2C] flex items-center justify-center">
            <Navigation size={14} className="text-[#14171C]" />
          </div>
          <span className="font-black text-[15px] tracking-tight">RUTA</span>
          <span className="text-[10px] text-[#5A6272] font-semibold">AGENCIA</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = tab === n.key;
            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${
                  active ? "bg-[#242A34] text-[#F2EFE9]" : "text-[#8B93A3] hover:text-[#F2EFE9] hover:bg-[#1C2127]"
                }`}
              >
                <Icon size={15} className={active ? "text-[#FF9E2C]" : ""} />
                {n.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-3 py-3 rounded-xl bg-[#1C2127] border border-[#2A303B]">
          <p className="text-[11px] text-[#8B93A3] mb-0.5">Plan actual</p>
          <p className="text-[13px] font-semibold capitalize">{agency?.plan || "—"} — {drivers.length} conductores</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#2A303B] sticky top-0 bg-[#14171C]/95 backdrop-blur z-10">
          <div>
            <h1 className="text-[17px] font-bold capitalize">{tab === "resumen" ? "Resumen del día" : NAV.find(n=>n.key===tab).label}</h1>
            <p className="text-[12px] text-[#8B93A3]">Miércoles, 22 de julio</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6272]" />
              <input
                placeholder="Buscar..."
                className="bg-[#1C2127] border border-[#2A303B] rounded-lg pl-8 pr-3 py-1.5 text-[13px] w-[180px] outline-none focus:border-[#FF9E2C]"
              />
            </div>
            <button className="w-8 h-8 rounded-lg bg-[#1C2127] border border-[#2A303B] flex items-center justify-center relative">
              <Bell size={14} className="text-[#8B93A3]" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#FF9E2C]" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[#FF9E2C] flex items-center justify-center text-[#14171C] font-bold text-[12px]">JS</div>
          </div>
        </header>

        <div className="p-6">
          {tab === "resumen" && (
            <>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard icon={Package} label="Entregas hoy" value={`${deliveredCount} / ${deliveries.length}`} />
                <StatCard icon={Users} label="Conductores activos" value={`${activeDrivers} de ${drivers.length}`} />
                <StatCard icon={DollarSign} label="Ingresos cobrados" value={`$${revenue.toFixed(2)}`} />
                <StatCard icon={X} label="Entregas fallidas" value={String(failedCount)} />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="col-span-2 bg-[#1C2127] border border-[#2A303B] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-[13.5px] font-semibold">Entregas por día — esta semana</p>
                    <span className="text-[11px] text-[#8B93A3]">276 total</span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={weekData}>
                      <CartesianGrid stroke="#2A303B" vertical={false} />
                      <XAxis dataKey="day" tick={{ fill: "#8B93A3", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#8B93A3", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip
                        contentStyle={{ background: "#242A34", border: "1px solid #2A303B", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#F2EFE9" }}
                      />
                      <Line type="monotone" dataKey="entregas" stroke="#FF9E2C" strokeWidth={2.5} dot={{ fill: "#FF9E2C", r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-[#1C2127] border border-[#2A303B] rounded-2xl p-5">
                  <p className="text-[13.5px] font-semibold mb-4">Alertas</p>
                  <div className="space-y-3">
                    <div className="flex gap-2.5">
                      <Circle size={7} className="text-[#E5484D] fill-[#E5484D] mt-1.5 shrink-0" />
                      <p className="text-[12.5px] text-[#C4CAD4]">Miguel Torres va retrasado 20 min en su ruta</p>
                    </div>
                    <div className="flex gap-2.5">
                      <Circle size={7} className="text-[#FF9E2C] fill-[#FF9E2C] mt-1.5 shrink-0" />
                      <p className="text-[12.5px] text-[#C4CAD4]">Factura de Distribuidora Caribe vencida</p>
                    </div>
                    <div className="flex gap-2.5">
                      <Circle size={7} className="text-[#E5484D] fill-[#E5484D] mt-1.5 shrink-0" />
                      <p className="text-[12.5px] text-[#C4CAD4]">1 entrega fallida sin reintento asignado</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-[#1C2127] border border-[#2A303B] rounded-2xl p-5">
                <p className="text-[13.5px] font-semibold mb-4">Conductores en ruta ahora</p>
                <div className="space-y-1">
                  {driverRows.map((d) => (
                    <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-[#2A303B] last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#242A34] flex items-center justify-center text-[11px] font-bold">
                          {d.name.split(" ").map(w=>w[0]).join("")}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium">{d.name}</p>
                          <p className="text-[11.5px] text-[#8B93A3]">{d.vehicle} · {d.done}/{d.stops} paradas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[12px] text-[#8B93A3] font-mono flex items-center gap-1">
                          <Clock size={12} /> {d.eta}
                        </span>
                        <Pill label={d.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === "conductores" && (
            <div className="bg-[#1C2127] border border-[#2A303B] rounded-2xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#2A303B] text-[11px] uppercase tracking-wide text-[#8B93A3]">
                    <th className="px-5 py-3 font-semibold">Conductor</th>
                    <th className="px-5 py-3 font-semibold">Vehículo</th>
                    <th className="px-5 py-3 font-semibold">Progreso</th>
                    <th className="px-5 py-3 font-semibold">ETA última parada</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {driverRows.map((d) => (
                    <tr key={d.id} className="border-b border-[#2A303B] last:border-0 hover:bg-[#242A34]/50">
                      <td className="px-5 py-3.5 text-[13px] font-medium flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#242A34] flex items-center justify-center text-[10.5px] font-bold">
                          {d.name.split(" ").map(w=>w[0]).join("")}
                        </div>
                        {d.name}
                      </td>
                      <td className="px-5 py-3.5 text-[13px] text-[#C4CAD4]">{d.vehicle}</td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-[#2A303B] overflow-hidden">
                            <div className="h-full bg-[#FF9E2C]" style={{ width: `${(d.done/d.stops)*100}%` }} />
                          </div>
                          <span className="text-[11.5px] text-[#8B93A3]">{d.done}/{d.stops}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-[13px] font-mono text-[#C4CAD4]">{d.eta}</td>
                      <td className="px-5 py-3.5"><Pill label={d.status} /></td>
                      <td className="px-5 py-3.5"><MoreVertical size={15} className="text-[#5A6272]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "facturacion" && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard icon={DollarSign} label="Cobrado este mes" value={`$${invoices.filter(i=>i.status==="pagado").reduce((s,i)=>s+Number(i.amount),0).toFixed(2)}`} />
                <StatCard icon={Clock} label="Pendiente de cobro" value={`$${invoices.filter(i=>i.status==="pendiente").reduce((s,i)=>s+Number(i.amount),0).toFixed(2)}`} />
                <StatCard icon={X} label="Vencido" value={`$${invoices.filter(i=>i.status==="vencido").reduce((s,i)=>s+Number(i.amount),0).toFixed(2)}`} />
              </div>
              <div className="bg-[#1C2127] border border-[#2A303B] rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-[#2A303B] text-[11px] uppercase tracking-wide text-[#8B93A3]">
                      <th className="px-5 py-3 font-semibold">Cliente</th>
                      <th className="px-5 py-3 font-semibold">Plan</th>
                      <th className="px-5 py-3 font-semibold">Monto</th>
                      <th className="px-5 py-3 font-semibold">Vence</th>
                      <th className="px-5 py-3 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceRows.map((c) => (
                      <tr key={c.id} className="border-b border-[#2A303B] last:border-0 hover:bg-[#242A34]/50">
                        <td className="px-5 py-3.5 text-[13px] font-medium">{c.name}</td>
                        <td className="px-5 py-3.5 text-[13px] text-[#C4CAD4]">{c.plan}</td>
                        <td className="px-5 py-3.5 text-[13px] font-mono">{c.amount}</td>
                        <td className="px-5 py-3.5 text-[13px] text-[#C4CAD4]">{c.date}</td>
                        <td className="px-5 py-3.5"><Pill label={c.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "reportes" && (
            <div className="bg-[#1C2127] border border-[#2A303B] rounded-2xl p-8 text-center">
              <BarChart3 size={28} className="text-[#5A6272] mx-auto mb-3" />
              <p className="text-[14px] font-semibold mb-1">Reportes detallados</p>
              <p className="text-[12.5px] text-[#8B93A3] max-w-[320px] mx-auto">
                Aquí irán reportes exportables de entregas, tiempos promedio y desempeño por conductor. Lo construimos en el próximo paso.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
