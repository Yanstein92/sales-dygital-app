import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, Users, Banknote, Calendar, Car, BarChart3, 
  ArrowUpRight, AlertCircle, CheckCircle2, PieChart, Info,
  Filter, RotateCcw, ChevronRight, Coins, ShieldAlert, Briefcase
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../lib/context';
import { Sale, Payment } from '../types';

export const AdminPerformanceDashboard: React.FC = () => {
  const { sales, payments, userProfile, teamMembers } = useApp();

  // Filter States
  const [filterMonth, setFilterMonth] = useState<string>('all'); // 'all' or 'YYYY-MM'
  const [filterCommercial, setFilterCommercial] = useState<string>('all');

  // Filter Sales that belong to this Admin's company
  const companySales = useMemo(() => {
    if (!userProfile?.companyId) return [];
    return sales.filter(s => s.company === userProfile.companyId);
  }, [sales, userProfile?.companyId]);

  // Unique months available in sales for filtering
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    companySales.forEach(s => {
      if (s.date && s.date.length >= 7) {
        months.add(s.date.substring(0, 7)); // 'YYYY-MM'
      }
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // Newest first
  }, [companySales]);

  // Filtered sales and payments based on selected options
  const filteredSales = useMemo(() => {
    return companySales.filter(s => {
      if (filterMonth !== 'all' && (!s.date || !s.date.startsWith(filterMonth))) return false;
      if (filterCommercial !== 'all' && s.commercial !== filterCommercial) return false;
      return true;
    });
  }, [companySales, filterMonth, filterCommercial]);

  const filteredSalesIds = useMemo(() => {
    return new Set(filteredSales.map(s => s.id));
  }, [filteredSales]);

  // Filtered payments that belong to the filtered sales
  const filteredPayments = useMemo(() => {
    return payments.filter(p => filteredSalesIds.has(p.saleId));
  }, [payments, filteredSalesIds]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    let totalCA = 0; // Chiffre d'Affaires (Sales Price + Transport)
    let totalPaid = 0;
    let totalRefunded = 0;
    let totalTransport = 0;

    filteredSales.forEach(s => {
      const price = Number(s.price) || 0;
      const transport = Number(s.transport) || 0;
      totalCA += price + transport;
      totalTransport += transport;

      // Handle refunds
      if (s.factureStatus === 'rembourse' && s.refundAmount) {
        totalRefunded += Number(s.refundAmount) || 0;
      }
    });

    filteredPayments.forEach(p => {
      totalPaid += Number(p.amount) || 0;
    });

    const netCA = totalCA - totalRefunded;
    const remainingToCollect = Math.max(0, netCA - totalPaid);
    const averageBasket = filteredSales.length > 0 ? (totalCA / filteredSales.length) : 0;

    return {
      totalCA,
      netCA,
      totalPaid,
      totalRefunded,
      remainingToCollect,
      averageBasket,
      totalTransport,
      count: filteredSales.length
    };
  }, [filteredSales, filteredPayments]);

  // Analytics: Sales & Revenue by Commercial
  const commercialPerformance = useMemo(() => {
    const data: Record<string, { name: string; salesCount: number; volume: number; paid: number; remaining: number }> = {};
    
    // Initialize with team members so everyone is represented
    teamMembers.forEach(member => {
      data[member.name] = {
        name: member.name,
        salesCount: 0,
        volume: 0,
        paid: 0,
        remaining: 0
      };
    });

    // Make sure unknown commercials listed in sales are also caught
    filteredSales.forEach(s => {
      const comm = s.commercial || 'À assigner';
      if (!data[comm]) {
        data[comm] = { name: comm, salesCount: 0, volume: 0, paid: 0, remaining: 0 };
      }
      const price = Number(s.price) || 0;
      const transport = Number(s.transport) || 0;
      const totalSaleVal = price + transport;
      
      data[comm].salesCount += 1;
      data[comm].volume += totalSaleVal;
      
      // Calculate payment for this specific sale
      const salePayments = payments.filter(p => p.saleId === s.id);
      const salePaid = salePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      data[comm].paid += salePaid;
      data[comm].remaining += Math.max(0, totalSaleVal - salePaid);
    });

    return Object.values(data).sort((a, b) => b.volume - a.volume);
  }, [filteredSales, payments, teamMembers]);

  // Analytics: Payment Method breakdown
  const paymentMethodsBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {
      'VIR': 0,
      'ESP': 0,
      'CHQ': 0,
      'CB': 0,
      'AUTRES': 0
    };
    
    filteredPayments.forEach(p => {
      const type = (p.type || 'AUTRES').toUpperCase();
      if (type in breakdown) {
        breakdown[type] += Number(p.amount) || 0;
      } else {
        breakdown['AUTRES'] += Number(p.amount) || 0;
      }
    });

    const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
    return Object.entries(breakdown).map(([name, value]) => ({
      name: name === 'VIR' ? 'Virement' : name === 'CHQ' ? 'Chèque' : name === 'ESP' ? 'Espèces' : name,
      value,
      percentage: total > 0 ? Math.round((value / total) * 100) : 0
    })).sort((a, b) => b.value - a.value);
  }, [filteredPayments]);

  // Analytics: Top Brands Sold
  const topBrands = useMemo(() => {
    const brands: Record<string, number> = {};
    filteredSales.forEach(s => {
      const brand = (s.marque || 'INCONNU').toUpperCase().trim();
      brands[brand] = (brands[brand] || 0) + 1;
    });
    const total = filteredSales.length;
    return Object.entries(brands)
      .map(([name, count]) => ({
        name,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredSales]);

  // Reset Filters helper
  const resetFilters = () => {
    setFilterMonth('all');
    setFilterCommercial('all');
  };

  // Format month to human readable
  const formatMonthLabel = (mString: string) => {
    if (mString === 'all') return 'Toutes les périodes';
    const [year, month] = mString.split('-');
    const monthsFr = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthsFr[mIdx] || month} ${year}`;
  };

  return (
    <div className="w-full space-y-6">
      {/* Welcome / Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-10 bg-[radial-gradient(circle_at_top_right,var(--color-indigo-400),transparent_50%)] pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase tracking-widest mb-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              Espace Direction
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Performance & Analyses
            </h1>
            <p className="text-slate-300 text-xs md:text-sm mt-1.5 font-medium max-w-xl leading-relaxed">
              Consultez l'état financier en temps réel de <span className="text-white font-black">{userProfile?.companyId}</span>, suivez les objectifs de vos commerciaux et gérez les encaissements à recevoir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 text-right">
              <span className="text-[10px] text-slate-300 uppercase font-bold tracking-wider block">Volume Global Géré</span>
              <span className="text-lg font-black text-white">{(stats.totalCA).toLocaleString('fr-FR')} €</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm font-bold">
            <Filter size={16} className="text-slate-400" />
            <span>Filtrer par :</span>
          </div>
          
          {/* Month Selector */}
          <div className="relative">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="all">Toutes les dates</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>{formatMonthLabel(month)}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
              <Calendar size={14} />
            </div>
          </div>

          {/* Commercial Selector */}
          <div className="relative">
            <select
              value={filterCommercial}
              onChange={(e) => setFilterCommercial(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="all">Tous les Commerciaux</option>
              {teamMembers.map(member => (
                <option key={member.uid} value={member.name}>{member.name}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
              <Users size={14} />
            </div>
          </div>
        </div>

        {/* Clear Filters */}
        {(filterMonth !== 'all' || filterCommercial !== 'all') && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline transition-all cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Réinitialiser les filtres</span>
          </button>
        )}
      </div>

      {/* KPI Cards Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total CA Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chiffre d'Affaires</span>
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><TrendingUp size={20} /></div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{(stats.totalCA).toLocaleString('fr-FR')} €</h3>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-2">
              <span className="font-extrabold text-slate-700">{stats.count}</span> dossier(s) finalisé(s).
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 text-indigo-50/40 pointer-events-none translate-x-4 translate-y-4">
            <TrendingUp className="w-full h-full" />
          </div>
        </div>

        {/* Amount Received / Paid */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Montant Encaissé</span>
            <div className="bg-emerald-50 p-2 rounded-lg text-emerald-600"><CheckCircle2 size={20} /></div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-600">{(stats.totalPaid).toLocaleString('fr-FR')} €</h3>
            <div className="flex items-center gap-1 text-[10px] mt-2">
              <span className="text-emerald-700 font-extrabold">
                {stats.totalCA > 0 ? Math.round((stats.totalPaid / stats.totalCA) * 100) : 0}%
              </span>
              <span className="text-slate-500">recouvré avec succès.</span>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 text-emerald-50/40 pointer-events-none translate-x-4 translate-y-4">
            <Banknote className="w-full h-full" />
          </div>
        </div>

        {/* Outstanding / Remaining to Collect */}
        <div className="bg-white border border-amber-200 bg-amber-50/10 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-amber-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">Reste à Recevoir</span>
            <div className="bg-amber-100 p-2 rounded-lg text-amber-700"><Coins size={20} /></div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-amber-700">{(stats.remainingToCollect).toLocaleString('fr-FR')} €</h3>
            <div className="flex items-center gap-1 text-[10px] text-amber-800 mt-2">
              <span className="font-extrabold">
                {stats.totalCA > 0 ? Math.round((stats.remainingToCollect / stats.totalCA) * 100) : 0}%
              </span>
              <span>du chiffre d'affaires total à percevoir.</span>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 text-amber-100/30 pointer-events-none translate-x-4 translate-y-4">
            <Coins className="w-full h-full" />
          </div>
        </div>

        {/* Average Basket Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Panier Moyen</span>
            <div className="bg-slate-100 p-2 rounded-lg text-slate-600"><Briefcase size={20} /></div>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800">{(Math.round(stats.averageBasket)).toLocaleString('fr-FR')} €</h3>
            <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-2">
              <span className="text-indigo-600 font-extrabold">Transport inclus: </span> {stats.totalTransport.toLocaleString('fr-FR')} €
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 text-slate-100/40 pointer-events-none translate-x-4 translate-y-4">
            <Car className="w-full h-full" />
          </div>
        </div>
      </div>

      {/* Main Analysis grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Commercial Team Leaderboard */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                Performance des Commerciaux
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">Ventes, volume d'affaires et restes à percevoir par commercial.</p>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-2">Commercial</th>
                  <th className="py-3 px-2 text-center">Dossiers</th>
                  <th className="py-3 px-2 text-right">Volume (CA)</th>
                  <th className="py-3 px-2 text-right">Encaissé</th>
                  <th className="py-3 px-2 text-right text-amber-700">Reste à payer</th>
                  <th className="py-3 px-2 text-right w-1/4">Répartition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-sm">
                {commercialPerformance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">Aucun commercial n'a de vente enregistrée sur cette période.</td>
                  </tr>
                ) : (
                  commercialPerformance.map(comm => {
                    const collectRatio = comm.volume > 0 ? (comm.paid / comm.volume) * 100 : 0;
                    return (
                      <tr key={comm.name} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-2 font-bold text-slate-800 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-[10px] text-slate-600">
                            {comm.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span>{comm.name}</span>
                        </td>
                        <td className="py-3 px-2 text-center font-black text-slate-700">{comm.salesCount}</td>
                        <td className="py-3 px-2 text-right font-black text-slate-900">{comm.volume.toLocaleString('fr-FR')} €</td>
                        <td className="py-3 px-2 text-right text-emerald-600 font-extrabold">{comm.paid.toLocaleString('fr-FR')} €</td>
                        <td className="py-3 px-2 text-right text-amber-700 font-extrabold">{comm.remaining.toLocaleString('fr-FR')} €</td>
                        <td className="py-3 px-2 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-extrabold text-slate-500">{Math.round(collectRatio)}% recouvré</span>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 max-w-[120px] overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, collectRatio)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Distribution (Payment Methods breakdown) */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <PieChart size={18} className="text-indigo-600" />
              Modes de Règlement
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Répartition du volume des virements, espèces, chèques, etc.</p>
            
            <div className="mt-6 space-y-4">
              {paymentMethodsBreakdown.filter(m => m.value > 0).length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold flex flex-col items-center gap-2">
                  <Info size={24} className="text-slate-300" />
                  <span>Aucun règlement enregistré.</span>
                </div>
              ) : (
                paymentMethodsBreakdown.map(method => {
                  if (method.value === 0) return null;
                  return (
                    <div key={method.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">{method.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-500">({method.percentage}%)</span>
                          <span className="font-black text-slate-900">{method.value.toLocaleString('fr-FR')} €</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-600 h-full rounded-full" 
                          style={{ width: `${method.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50 rounded-xl p-3 text-slate-500 text-xs font-bold leading-relaxed flex items-start gap-2">
            <Info size={16} className="text-indigo-500 shrink-0 mt-0.5" />
            <span>Les pourcentages représentent la part des paiements effectivement encaissés / reçus.</span>
          </div>
        </div>
      </div>

      {/* Brand preferences and Outstanding list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Brands Graph */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Car size={18} className="text-indigo-600" />
            Top Marques Vendues
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Les marques de véhicules les plus populaires.</p>

          <div className="mt-6 space-y-4">
            {topBrands.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold">Aucune marque trouvée.</div>
            ) : (
              topBrands.map(brand => (
                <div key={brand.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800">{brand.name}</span>
                    <span className="font-black text-indigo-600">{brand.count} vente(s) ({brand.percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-50 h-2.5 rounded-full overflow-hidden border border-slate-100">
                    <div 
                      className="bg-gradient-to-r from-indigo-500 to-blue-600 h-full rounded-full" 
                      style={{ width: `${brand.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Outstanding client cases */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 lg:col-span-2">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert size={18} className="text-amber-600" />
            Dossiers Non Soldés Prioritaires
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">Clients avec un reste à payer supérieur à zéro, triés par montant.</p>

          <div className="mt-4 divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
            {filteredSales.filter(s => {
              // Calculate remaining
              const salePayments = payments.filter(p => p.saleId === s.id);
              const paidAmount = salePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
              const remaining = Math.max(0, (Number(s.price) || 0) + (Number(s.transport) || 0) - paidAmount);
              return remaining > 0;
            }).map(s => {
              const salePayments = payments.filter(p => p.saleId === s.id);
              const paidAmount = salePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
              const remaining = Math.max(0, (Number(s.price) || 0) + (Number(s.transport) || 0) - paidAmount);

              return (
                <div key={s.id} className="py-3 flex items-center justify-between text-sm hover:bg-slate-50/50 px-2 rounded-lg transition-colors">
                  <div className="flex flex-col">
                    <div className="font-bold text-slate-800">{s.clientName || 'Client Inconnu'}</div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                      <span>BDC: #{s.bdcNumber}</span>
                      <span>•</span>
                      <span>{s.marque} {s.modele}</span>
                      <span>•</span>
                      <span className="font-bold text-slate-600">{s.commercial}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-black text-amber-700">{remaining.toLocaleString('fr-FR')} €</div>
                      <div className="text-[10px] text-slate-400">Restant sur {(Number(s.price) || 0).toLocaleString('fr-FR')} €</div>
                    </div>
                    <button 
                      onClick={() => window.location.hash = `detail/${s.id}`}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-all"
                      title="Consulter"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              );
            }).length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold">Tous vos dossiers sont entièrement soldés ! 🎉</div>
            ) : null}
          </div>
        </div>

      </div>
    </div>
  );
};
