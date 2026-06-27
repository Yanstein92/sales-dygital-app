import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, Users, Banknote, Calendar, Car, BarChart3, 
  ArrowUpRight, AlertCircle, CheckCircle2, PieChart, Info,
  Filter, RotateCcw, ChevronRight, Coins, ShieldAlert, Briefcase,
  Clock, Undo2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../lib/context';
import { Sale, Payment } from '../types';
import { db, doc, setDoc, getDoc, getUserDocPath } from '../lib/firebase';

interface AdminPerformanceDashboardProps {
  onShowToast?: (msg: string, type: 'success' | 'error') => void;
}

export const AdminPerformanceDashboard: React.FC<AdminPerformanceDashboardProps> = ({ onShowToast }) => {
  const { sales, payments, userProfile, teamMembers, databaseUid } = useApp();

  // Filter States
  const [filterMonth, setFilterMonth] = useState<string>('all'); // 'all' or 'YYYY-MM'
  const [filterCommercial, setFilterCommercial] = useState<string>('all');
  const [viewFormat, setViewFormat] = useState<'table' | 'charts'>('table');
  const [showDiscounts, setShowDiscounts] = useState<boolean>(false);

  const [latePaymentDays, setLatePaymentDays] = useState<number>(5);
  const [isThresholdLoading, setIsThresholdLoading] = useState(false);

  useEffect(() => {
    const fetchThreshold = async () => {
      if (!databaseUid) return;
      try {
        setIsThresholdLoading(true);
        const configDocRef = doc(db, getUserDocPath(databaseUid) + '/settings/enterprise_config');
        const snap = await getDoc(configDocRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data && typeof data.latePaymentDaysThreshold === 'number') {
            setLatePaymentDays(data.latePaymentDaysThreshold);
          }
        }
      } catch (e) {
        console.error("Error reading enterprise config:", e);
      } finally {
        setIsThresholdLoading(false);
      }
    };
    fetchThreshold();
  }, [databaseUid]);

  const handleSaveLatePaymentThreshold = async () => {
    if (!databaseUid) return;
    try {
      const configDocRef = doc(db, getUserDocPath(databaseUid) + '/settings/enterprise_config');
      await setDoc(configDocRef, { latePaymentDaysThreshold: latePaymentDays }, { merge: true });
      if (onShowToast) {
        onShowToast("Seuil de retard de paiement mis à jour !", "success");
      }
    } catch (e) {
      console.error("Error writing enterprise config:", e);
      if (onShowToast) {
        onShowToast("Erreur lors de l'enregistrement du seuil.", "error");
      }
    }
  };

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
    let totalDiscount = 0;
    let remainingToCollect = 0;

    filteredSales.forEach(s => {
      const price = Number(s.price) || 0;
      const transport = Number(s.transport) || 0;
      const discount = Number(s.discountAmount) || 0;
      totalCA += price + transport;
      totalTransport += transport;
      totalDiscount += discount;

      // Handle refunds
      if (s.factureStatus === 'rembourse') {
        if (s.refundAmount) {
          totalRefunded += Number(s.refundAmount) || 0;
        }
      } else {
        // Calculate remaining to pay for active sales only
        const salePayments = payments.filter(p => p.saleId === s.id);
        const salePaid = salePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        remainingToCollect += Math.max(0, price + transport - salePaid);
      }
    });

    filteredPayments.forEach(p => {
      totalPaid += Number(p.amount) || 0;
    });

    const netCA = totalCA - totalRefunded;
    const netPaid = totalPaid - totalRefunded;
    const averageBasket = filteredSales.length > 0 ? (totalCA / filteredSales.length) : 0;

    return {
      totalCA,
      netCA,
      totalPaid,
      netPaid,
      totalRefunded,
      remainingToCollect,
      averageBasket,
      totalTransport,
      totalDiscount,
      count: filteredSales.length
    };
  }, [filteredSales, filteredPayments, payments]);

  // Analytics: Sales & Revenue by Commercial
  const commercialPerformance = useMemo(() => {
    const data: Record<string, { name: string; salesCount: number; volume: number; paid: number; remaining: number; discounts: number }> = {};
    
    // Initialize with team members so everyone is represented
    teamMembers.forEach(member => {
      data[member.name] = {
        name: member.name,
        salesCount: 0,
        volume: 0,
        paid: 0,
        remaining: 0,
        discounts: 0
      };
    });

    // Make sure unknown commercials listed in sales are also caught
    filteredSales.forEach(s => {
      const comm = s.commercial || 'À assigner';
      if (!data[comm]) {
        data[comm] = { name: comm, salesCount: 0, volume: 0, paid: 0, remaining: 0, discounts: 0 };
      }
      const price = Number(s.price) || 0;
      const transport = Number(s.transport) || 0;
      const discount = Number(s.discountAmount) || 0;
      const refund = (s.factureStatus === 'rembourse' && s.refundAmount) ? Number(s.refundAmount) : 0;
      const totalSaleVal = price + transport - refund;
      
      data[comm].salesCount += 1;
      data[comm].volume += totalSaleVal;
      data[comm].discounts += discount;
      
      // Calculate payment for this specific sale
      const salePayments = payments.filter(p => p.saleId === s.id);
      const salePaid = salePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) - refund;
      data[comm].paid += salePaid;
      
      const isRembourse = s.factureStatus === 'rembourse';
      const saleRemaining = isRembourse ? 0 : Math.max(0, totalSaleVal - salePaid);
      data[comm].remaining += saleRemaining;
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

          {/* Period Selector */}
          <div className="relative">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 pl-3 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="all">Toutes les périodes</option>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total CA Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Chiffre d'Affaires</span>
            <div className="bg-indigo-50 p-2 rounded-lg text-indigo-600"><TrendingUp size={20} /></div>
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">{(stats.netCA).toLocaleString('fr-FR')} €</h3>
            <div className="flex flex-col gap-0.5 mt-2 text-[10px] text-slate-500">
              <div><span className="font-extrabold text-slate-700">{stats.count}</span> dossier(s).</div>
              {stats.totalRefunded > 0 && <div>Brut: {stats.totalCA.toLocaleString('fr-FR')} €</div>}
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
            <h3 className="text-xl font-black text-emerald-600">{(stats.netPaid).toLocaleString('fr-FR')} €</h3>
            <div className="flex flex-col gap-0.5 mt-2 text-[10px]">
              <div className="text-slate-500">
                <span className="text-emerald-700 font-extrabold">
                  {stats.netCA > 0 ? Math.round((stats.netPaid / stats.netCA) * 100) : 0}%
                </span>{' '}
                recouvré.
              </div>
              {stats.totalRefunded > 0 && <div className="text-slate-400">Brut: {stats.totalPaid.toLocaleString('fr-FR')} €</div>}
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
            <h3 className="text-xl font-black text-amber-700">{(stats.remainingToCollect).toLocaleString('fr-FR')} €</h3>
            <div className="flex items-center gap-1 text-[10px] text-amber-800 mt-2">
              <span className="font-extrabold">
                {stats.netCA > 0 ? Math.round((stats.remainingToCollect / stats.netCA) * 100) : 0}%
              </span>
              <span>à percevoir.</span>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 text-amber-100/30 pointer-events-none translate-x-4 translate-y-4">
            <Coins className="w-full h-full" />
          </div>
        </div>

        {/* Refunds Card */}
        <div className="bg-white border border-rose-200 bg-rose-50/10 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-rose-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">Remboursements</span>
            <div className="bg-rose-100 p-2 rounded-lg text-rose-700"><Undo2 size={20} /></div>
          </div>
          <div>
            <h3 className="text-xl font-black text-rose-700">{(stats.totalRefunded).toLocaleString('fr-FR')} €</h3>
            <div className="flex items-center gap-1 text-[10px] text-rose-500 mt-2">
              <span>Montants restitués.</span>
            </div>
          </div>
          <div className="absolute right-0 bottom-0 w-24 h-24 text-rose-100/30 pointer-events-none translate-x-4 translate-y-4">
            <Undo2 className="w-full h-full" />
          </div>
        </div>

        {/* Average Basket Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Panier Moyen</span>
            <div className="bg-slate-100 p-2 rounded-lg text-slate-600"><Briefcase size={20} /></div>
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-800">{(Math.round(stats.averageBasket)).toLocaleString('fr-FR')} €</h3>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-indigo-600" />
                Performance des Commerciaux
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">Ventes, volume d'affaires et restes à percevoir par commercial.</p>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-center shrink-0">
              <button 
                onClick={() => setViewFormat('table')}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
                  viewFormat === 'table' ? 'bg-white text-slate-800 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Tableau
              </button>
              <button 
                onClick={() => setViewFormat('charts')}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
                  viewFormat === 'charts' ? 'bg-white text-slate-800 shadow-sm font-extrabold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Graphique
              </button>
            </div>
          </div>

          {viewFormat === 'table' ? (
            <>
              <div className="flex-1 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-2">Commercial</th>
                    <th className="py-3 px-2 text-center">Dossiers</th>
                    <th className="py-3 px-2 text-right">Volume (CA)</th>
                    {showDiscounts && <th className="py-3 px-2 text-right text-red-500">Remises</th>}
                    <th className="py-3 px-2 text-right">Encaissé</th>
                    <th className="py-3 px-2 text-right text-amber-700">Reste à payer</th>
                    <th className="py-3 px-2 text-right w-1/4">Répartition</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {commercialPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={showDiscounts ? 7 : 6} className="py-8 text-center text-slate-400 font-bold">Aucun commercial n'a de vente enregistrée sur cette période.</td>
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
                          {showDiscounts && <td className="py-3 px-2 text-right text-red-600 font-extrabold">{comm.discounts > 0 ? `-${comm.discounts.toLocaleString('fr-FR')} €` : '-'}</td>}
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
            <div className="flex justify-end mt-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-500 cursor-pointer hover:text-slate-700 transition-colors">
                <input 
                  type="checkbox" 
                  checked={showDiscounts} 
                  onChange={(e) => setShowDiscounts(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 bg-white cursor-pointer"
                />
                Afficher le détail des remises (manque à gagner)
              </label>
            </div>
            </>
          ) : (
            <div className="space-y-8 py-4 animate-fade-in flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Real SVG Curve and Area Graph */}
                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Volume d'Affaires (CA) par Commercial</h4>
                  <div className="bg-slate-50/50 rounded-2xl border border-slate-150 p-6 flex flex-col justify-between h-[300px]">
                    {commercialPerformance.length === 0 ? (
                      <p className="text-center text-xs text-slate-400 my-auto">Aucune donnée</p>
                    ) : (
                      <div className="w-full h-full flex flex-col justify-between">
                        {/* Custom SVG Line & Area Chart */}
                        <div className="flex-1 w-full relative">
                          {(() => {
                            const maxVol = Math.max(...commercialPerformance.map(c => c.volume), 1000);
                            const N = commercialPerformance.length;
                            const points = commercialPerformance.map((comm, idx) => {
                              const x = 60 + (idx * (N > 1 ? 400 / (N - 1) : 400));
                              const y = 200 - (comm.volume / maxVol) * 150;
                              return { x, y, name: comm.name, volume: comm.volume };
                            });

                            const linePath = points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                            const areaPath = points.length > 0 
                              ? `${linePath} L ${points[points.length - 1].x} 200 L ${points[0].x} 200 Z`
                              : '';

                            return (
                              <svg className="w-full h-full min-h-[220px]" viewBox="0 0 500 230" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
                                  </linearGradient>
                                </defs>

                                {/* Grid Lines */}
                                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                                  <g key={ratio}>
                                    <line 
                                      x1="60" 
                                      y1={200 - ratio * 150} 
                                      x2="480" 
                                      y2={200 - ratio * 150} 
                                      stroke="#e2e8f0" 
                                      strokeWidth="1" 
                                      strokeDasharray="4 4"
                                    />
                                    <text 
                                      x="50" 
                                      y={200 - ratio * 150 + 4} 
                                      textAnchor="end" 
                                      className="text-[9px] font-mono text-slate-400 font-bold"
                                    >
                                      {Math.round(maxVol * ratio).toLocaleString('fr-FR')} €
                                    </text>
                                  </g>
                                ))}

                                {/* Colored Area */}
                                {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

                                {/* Smooth Line */}
                                {linePath && (
                                  <path 
                                    d={linePath} 
                                    fill="none" 
                                    stroke="#4f46e5" 
                                    strokeWidth="3" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                  />
                                )}

                                {/* Highlight Dots */}
                                {points.map((p, idx) => (
                                  <g key={idx}>
                                    <circle 
                                      cx={p.x} 
                                      cy={p.y} 
                                      r="6" 
                                      fill="#ffffff" 
                                      stroke="#4f46e5" 
                                      strokeWidth="3" 
                                      className="transition-all hover:r-8 cursor-pointer"
                                    />
                                    <circle 
                                      cx={p.x} 
                                      cy={p.y} 
                                      r="2" 
                                      fill="#4f46e5" 
                                    />
                                    {/* X-Axis labels */}
                                    <text 
                                      x={p.x} 
                                      y="220" 
                                      textAnchor="middle" 
                                      className="text-[9px] font-black text-slate-500"
                                    >
                                      {p.name}
                                    </text>
                                  </g>
                                ))}
                              </svg>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Donut percentage rond */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taux Global de Recouvrement</h4>
                  <div className="bg-slate-50/50 rounded-2xl border border-slate-150 p-6 flex flex-col items-center justify-center h-[300px]">
                    {(() => {
                      const totalVol = commercialPerformance.reduce((sum, c) => sum + c.volume, 0);
                      const totalPaid = commercialPerformance.reduce((sum, c) => sum + c.paid, 0);
                      const totalRemaining = commercialPerformance.reduce((sum, c) => sum + c.remaining, 0);
                      const pct = totalVol > 0 ? Math.round((totalPaid / totalVol) * 100) : 0;
                      const circumference = 2 * Math.PI * 55; // radius is 55
                      const strokeDashoffset = circumference - (pct / 100) * circumference;

                      return (
                        <div className="text-center space-y-4">
                          <div className="relative flex items-center justify-center">
                            <svg width="140" height="140" viewBox="0 0 140 140" className="transform -rotate-90">
                              {/* Background track circle */}
                              <circle
                                cx="70"
                                cy="70"
                                r="55"
                                fill="transparent"
                                stroke="#e2e8f0"
                                strokeWidth="12"
                              />
                              {/* Progress arc */}
                              <circle
                                cx="70"
                                cy="70"
                                r="55"
                                fill="transparent"
                                stroke="url(#donutGrad)"
                                strokeWidth="12"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                className="transition-all duration-1000 ease-out"
                              />
                              <defs>
                                <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                  <stop offset="0%" stopColor="#10b981" />
                                  <stop offset="100%" stopColor="#059669" />
                                </linearGradient>
                              </defs>
                            </svg>
                            {/* Content in center */}
                            <div className="absolute text-center">
                              <span className="text-2xl font-black text-slate-900 block">{pct}%</span>
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Recouvré</span>
                            </div>
                          </div>
                          <div className="space-y-1.5 text-xs text-slate-600 font-bold">
                            <div className="flex justify-between items-center gap-6">
                              <span>Volume Total :</span>
                              <span className="font-black text-slate-900">{totalVol.toLocaleString('fr-FR')} €</span>
                            </div>
                            <div className="flex justify-between items-center gap-6 text-emerald-600">
                              <span>Encaissé :</span>
                              <span className="font-black">{totalPaid.toLocaleString('fr-FR')} €</span>
                            </div>
                            <div className="flex justify-between items-center gap-6 text-amber-700">
                              <span>Reste à percevoir :</span>
                              <span className="font-black">{totalRemaining.toLocaleString('fr-FR')} €</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            </div>
          )}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-600" />
                Dossiers Non Soldés Prioritaires
              </h2>
              <p className="text-slate-500 text-xs mt-0.5">Dossiers avec un reste à payer supérieur à zéro et un retard de paiement &ge; {latePaymentDays} jours.</p>
            </div>
            {userProfile?.role === 'admin' && (
              <div className="flex items-center gap-2 shrink-0 bg-slate-50 p-2 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500">Délai :</span>
                <input 
                  type="number" 
                  min={1} 
                  max={30} 
                  className="w-10 bg-white border border-slate-200 text-xs font-black text-slate-800 outline-none text-center rounded py-1" 
                  value={latePaymentDays}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setLatePaymentDays(val);
                  }}
                />
                <span className="text-[11px] font-bold text-slate-400">jours</span>
                <button 
                  onClick={handleSaveLatePaymentThreshold}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg transition-all shadow cursor-pointer"
                >
                  Valider
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
            {(() => {
              const unpaidItems = filteredSales.map(s => {
                const salePayments = payments.filter(p => p.saleId === s.id);
                const paidAmount = salePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                const remaining = s.factureStatus === 'rembourse' ? 0 : Math.max(0, (Number(s.price) || 0) + (Number(s.transport) || 0) - paidAmount);
                
                let diffDays = 0;
                if (s.date) {
                  const saleDate = new Date(s.date);
                  const today = new Date();
                  today.setHours(0,0,0,0);
                  saleDate.setHours(0,0,0,0);
                  diffDays = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));
                }
                return { sale: s, remaining, diffDays };
              })
              .filter(item => item.remaining > 0 && item.diffDays >= latePaymentDays)
              .sort((a, b) => b.diffDays - a.diffDays);

              if (unpaidItems.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 font-bold">Aucun dossier non soldé en retard (&ge; {latePaymentDays} jours) actuellement ! 🎉</div>
                );
              }

              return unpaidItems.map(({ sale: s, remaining, diffDays }) => {
                return (
                  <div 
                    key={s.id} 
                    onClick={() => window.location.hash = `detail/${s.id}`}
                    className="py-3 flex items-center justify-between text-sm hover:bg-slate-50/80 px-2 rounded-lg transition-all cursor-pointer group/row"
                  >
                    <div className="flex flex-col">
                      <div className="font-bold text-slate-800 flex items-center gap-2">
                        {s.clientName || 'Client Inconnu'}
                        <span className="bg-red-50 text-red-700 text-[10px] font-black border border-red-200/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Clock size={10} /> Retard : J+{diffDays}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-1.5">
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
                      <div className="p-1.5 text-slate-400 group-hover/row:text-indigo-600 group-hover/row:bg-slate-100 rounded-lg transition-all">
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>

      </div>

      {/* Refund Tracker Section */}
      <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <div className="pb-3 border-b border-slate-100 mb-4">
          <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Undo2 size={18} className="text-rose-600" />
            Suivi des Véhicules Remboursés
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Historique complet des véhicules remboursés aux clients pour la période et le commercial sélectionnés.
          </p>
        </div>

        {(() => {
          const refundedSales = filteredSales.filter(s => s.factureStatus === 'rembourse');

          if (refundedSales.length === 0) {
            return (
              <div className="py-12 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
                <Undo2 size={32} className="text-slate-300 animate-pulse" />
                <span>Aucun remboursement enregistré pour cette sélection.</span>
              </div>
            );
          }

          return (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-3 px-4">N° BDC</th>
                    <th className="py-3 px-4">Client / Bénéficiaire</th>
                    <th className="py-3 px-4">Véhicule</th>
                    <th className="py-3 px-4">Commercial</th>
                    <th className="py-3 px-4">Date & Mode</th>
                    <th className="py-3 px-4">Motif / Commentaire</th>
                    <th className="py-3 px-4 text-right">Montant</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {refundedSales.map(s => (
                    <tr 
                      key={s.id}
                      onClick={() => window.location.hash = `detail/${s.id}`}
                      className="hover:bg-slate-50/80 transition-all cursor-pointer group/row"
                    >
                      <td className="py-4 px-4 font-mono font-bold text-slate-700">#{s.bdcNumber}</td>
                      <td className="py-4 px-4">
                        <div className="font-extrabold text-slate-900">{s.clientName || 'Inconnu'}</div>
                        <div className="text-[10px] text-slate-400">{s.clientPhone || s.clientEmail || ''}</div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">{s.marque} {s.modele}</div>
                        <div className="text-[10px] font-mono text-slate-500">{s.immatriculation || s.chassis || ''}</div>
                      </td>
                      <td className="py-4 px-4 font-bold text-slate-600">{s.commercial}</td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-slate-800">
                          {s.refundDate ? new Date(s.refundDate).toLocaleDateString('fr-FR') : '-'}
                        </div>
                        <div className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 inline-block mt-0.5">
                          {s.refundMethod || 'Virement'}
                        </div>
                      </td>
                      <td className="py-4 px-4 max-w-xs">
                        <p className="text-xs text-slate-500 italic truncate" title={s.refundDetails}>
                          {s.refundDetails || 'Aucun motif renseigné'}
                        </p>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="font-black text-rose-600">
                          -{(Number(s.refundAmount) || 0).toLocaleString('fr-FR')} €
                        </div>
                        <div className="text-[10px] text-slate-400">
                          sur {(Number(s.price) || 0).toLocaleString('fr-FR')} €
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="p-1.5 text-slate-400 group-hover/row:text-indigo-600 group-hover/row:bg-slate-100 rounded-lg transition-all inline-block">
                          <ChevronRight size={16} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

    </div>
  );
};
