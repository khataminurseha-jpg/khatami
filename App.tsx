
import React, { useState, useEffect, useCallback } from 'react';
import { DrillItem, AppData, User, SessionData, Variation } from './types';
import { DAYS, COEFFS, PERCENTS } from './constants';
import { loginWithGoogle, logoutUser, subscribeToAuthChanges, saveToCloud, loadFromCloud, isFirebaseInitialized } from './services/firebase';
import { getTrainingAdvice } from './services/geminiService';
import { 
  Dumbbell, 
  BarChart3, 
  Cloud, 
  Download, 
  LogOut, 
  Plus, 
  Trash2, 
  RefreshCcw, 
  ChevronRight,
  Info,
  Sparkles,
  Printer
} from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');
  const [user, setUser] = useState<User | null>(null);
  const [teamName, setTeamName] = useState('TIM: INDONESIA WARRIORS (U-20)');
  const [drills, setDrills] = useState<DrillItem[]>([]);
  const [sessionData, setSessionData] = useState<SessionData[]>([]);
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [variations, setVariations] = useState<Record<string, Variation[]>>({});
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Authentication persistence
  useEffect(() => {
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
      if (u) setView('dashboard');
    });
    return () => unsubscribe();
  }, []);

  // Calculation logic
  const calculateDrill = useCallback((id: string, base: number, fact: number) => {
    setDrills(prev => prev.map(d => {
      if (d.id === id) {
        const total = base * fact * 2;
        const dailyAvg = (total * 0.69) / 6;
        const dailyValues = COEFFS.map(c => Math.round(dailyAvg * c));
        return { ...d, base, fact, total, dailyValues };
      }
      return d;
    }));
  }, []);

  const addDrill = () => {
    const newId = crypto.randomUUID();
    const newDrill: DrillItem = {
      id: newId,
      category: '',
      name: '',
      base: 0,
      fact: 8,
      total: 0,
      dailyValues: [0, 0, 0, 0, 0, 0]
    };
    setDrills([...drills, newDrill]);
  };

  const removeDrill = (id: string) => {
    setDrills(drills.filter(d => d.id !== id));
  };

  const updateDrill = (id: string, field: keyof DrillItem, value: any) => {
    setDrills(prev => prev.map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: value };
        if (field === 'base' || field === 'fact') {
          // Trigger recalc
          const total = updated.base * updated.fact * 2;
          const dailyAvg = (total * 0.69) / 6;
          updated.dailyValues = COEFFS.map(c => Math.round(dailyAvg * c));
          updated.total = total;
        }
        return updated;
      }
      return d;
    }));
  };

  const generateDailyPlan = useCallback(() => {
    const newSessionData: SessionData[] = [];
    let counter = 1;

    DAYS.forEach((dayName, dayIndex) => {
      const activeDrillsForDay = drills.filter(d => d.dailyValues[dayIndex] > 0);
      
      activeDrillsForDay.forEach(d => {
        const rawVal = d.dailyValues[dayIndex];
        const roundedVal = Math.round(rawVal / 10) * 10;
        const targetSets = "4";
        const repsPerSet = Math.round(roundedVal / 4);
        
        newSessionData.push({
          id: counter++,
          day: dayName,
          category: d.category || 'Uncategorized',
          drill: d.name || 'Untitled Drill',
          targetSets,
          repsPerSet,
          rest: '90s'
        });
      });
    });

    setSessionData(newSessionData);
  }, [drills]);

  const updateSessionTarget = (id: number, sets: string) => {
    setSessionData(prev => prev.map(s => {
      if (s.id === id) {
        const setNum = parseFloat(sets) || 1;
        const roundedVal = Math.round((s.repsPerSet * (parseFloat(s.targetSets) || 1)) / 10) * 10;
        return { ...s, targetSets: sets, repsPerSet: Math.round(roundedVal / setNum) };
      }
      return s;
    }));
  };

  const addVariation = (drillId: number, reps: number) => {
    const key = `${selectedDay}-${drillId}`;
    const newVar: Variation = {
      id: crypto.randomUUID(),
      drillId,
      name: '',
      sets: 0,
      reps: reps.toString()
    };
    setVariations(prev => ({
      ...prev,
      [key]: [...(prev[key] || []), newVar]
    }));
  };

  const updateVariation = (drillId: number, varId: string, field: keyof Variation, value: any) => {
    const key = `${selectedDay}-${drillId}`;
    setVariations(prev => ({
      ...prev,
      [key]: prev[key].map(v => v.id === varId ? { ...v, [field]: value } : v)
    }));
  };

  const removeVariation = (drillId: number, varId: string) => {
    const key = `${selectedDay}-${drillId}`;
    setVariations(prev => ({
      ...prev,
      [key]: prev[key].filter(v => v.id !== varId)
    }));
  };

  const save = async () => {
    const data: AppData = { teamName, drills, variations };
    if (user) {
      setIsLoading(true);
      try {
        await saveToCloud(user.uid, data);
        alert("Success: Saved to Cloud!");
      } catch (err) {
        alert("Error saving to cloud. Saved to local instead.");
        localStorage.setItem('sport_science_data', JSON.stringify(data));
      } finally {
        setIsLoading(false);
      }
    } else {
      localStorage.setItem('sport_science_data', JSON.stringify(data));
      alert("Success: Saved to Device (Local)!");
    }
  };

  const load = async () => {
    if (user) {
      setIsLoading(true);
      const data = await loadFromCloud(user.uid);
      if (data) {
        setTeamName(data.teamName);
        setDrills(data.drills || []);
        setVariations(data.variations || {});
      }
      setIsLoading(false);
    } else {
      const local = localStorage.getItem('sport_science_data');
      if (local) {
        const data = JSON.parse(local);
        setTeamName(data.teamName);
        setDrills(data.drills || []);
        setVariations(data.variations || {});
      }
    }
  };

  const askAi = async () => {
    if (!drills.length) return;
    setIsLoading(true);
    const summary = drills.map(d => d.name).join(', ');
    const advice = await getTrainingAdvice(teamName, summary);
    setAiAdvice(advice || '');
    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      if (!isFirebaseInitialized) {
        alert("Firebase is not initialized. Using guest mode.");
        setView('dashboard');
        return;
      }
      await loginWithGoogle();
      setView('dashboard');
    } catch (error) {
      console.error(error);
      alert("Authentication failed. Ensure Project ID is correctly set.");
      setView('dashboard'); // Fallback to guest
    }
  };

  // Render Sub-components
  const LandingView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 grid-lines pointer-events-none opacity-40"></div>
      <div className="z-10 text-center">
        <h1 className="text-6xl md:text-8xl font-black font-orbitron mb-2 bg-gradient-to-r from-white via-sky-400 to-blue-600 bg-clip-text text-transparent drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
          SPORT SCIENCE
        </h1>
        <div className="text-2xl md:text-3xl font-orbitron font-bold text-sky-400 tracking-[0.3em] mb-8">
          TRAINING PLANNER PRO
        </div>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12">
          High Performance Analytics & Periodization System for Elite Athletes and Performance Coaches.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-16">
          <FeatureCard 
            icon={<BarChart3 className="w-8 h-8 text-sky-400" />}
            title="Macro Volume"
            desc="Calculate weekly training loads with precision using coefficient-based algorithms."
          />
          <FeatureCard 
            icon={<RefreshCcw className="w-8 h-8 text-sky-400" />}
            title="Session Design"
            desc="Break down drills into sets, reps, and variations tailored to daily objectives."
          />
          <FeatureCard 
            icon={<Cloud className="w-8 h-8 text-sky-400" />}
            title="Hybrid Storage"
            desc="Save your plans locally or to Cloud. Seamlessly sync between devices."
          />
        </div>

        <button 
          onClick={() => setView('login')}
          className="px-12 py-5 bg-sky-500 hover:bg-white hover:text-slate-950 text-white font-orbitron font-bold text-xl rounded-full transition-all duration-300 transform hover:scale-110 shadow-[0_0_30px_rgba(56,189,248,0.6)]"
        >
          ENTER SYSTEM
        </button>
      </div>
    </div>
  );

  const LoginView = () => (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-slate-900/80 backdrop-blur-xl p-10 rounded-3xl border border-slate-700 w-full max-w-md shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-sky-500/10 rounded-2xl border border-sky-500/20">
            <Dumbbell className="w-12 h-12 text-sky-400" />
          </div>
        </div>
        <h2 className="text-2xl font-orbitron font-bold text-center mb-2">ACCESS CONTROL</h2>
        <p className="text-slate-400 text-center mb-8">Please authenticate to continue</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 py-4 rounded-xl font-bold mb-6 hover:bg-slate-100 transition-colors shadow-lg"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
          LOGIN WITH GOOGLE
        </button>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or continue as guest</span></div>
        </div>

        <button 
          onClick={() => setView('dashboard')}
          className="w-full border border-slate-700 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-colors"
        >
          GUEST ACCESS (Local Only)
        </button>

        <button 
          onClick={() => setView('landing')}
          className="w-full text-slate-500 text-sm mt-6 hover:text-sky-400 transition-colors"
        >
          ← Return to Home
        </button>
      </div>
    </div>
  );

  const DashboardView = () => (
    <div className="min-h-screen p-4 md:p-8">
      <header className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-800/50 backdrop-blur-md p-6 rounded-3xl border border-slate-700 mb-8 gap-6">
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-sky-400">TRAINING PLANNER PRO</h1>
          <p className="text-slate-400 text-sm">Macro Calculation & Daily Session Builder</p>
          <input 
            type="text" 
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="bg-transparent border-b border-dashed border-slate-600 focus:border-sky-400 outline-none mt-2 text-lg text-white w-full md:w-96"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionBtn onClick={save} icon={<Cloud />} label="SAVE" variant="sky" />
          <ActionBtn onClick={load} icon={<Download />} label="LOAD" variant="slate" />
          <ActionBtn onClick={() => window.print()} icon={<Printer />} label="PRINT" variant="slate" />
          <ActionBtn onClick={() => { logoutUser(); setView('landing'); }} icon={<LogOut />} label="LOGOUT" variant="danger" />
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto space-y-8">
        {/* AI Insight */}
        {aiAdvice && (
          <div className="bg-gradient-to-r from-sky-900/40 to-indigo-900/40 border border-sky-500/30 p-4 rounded-2xl flex gap-4 items-center animate-pulse">
            <Sparkles className="w-6 h-6 text-sky-400 flex-shrink-0" />
            <p className="text-sm text-sky-100 italic">"{aiAdvice}"</p>
            <button onClick={() => setAiAdvice('')} className="ml-auto text-sky-400 hover:text-white">×</button>
          </div>
        )}

        {/* Section 1: Weekly Volume */}
        <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-orbitron font-bold text-sky-400 flex items-center gap-2">
              <span className="bg-sky-500/20 p-2 rounded-lg">1</span> WEEKLY VOLUME DISTRIBUTION
            </h2>
            <div className="flex gap-2">
              <button onClick={askAi} className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500/40 transition-all">
                <Sparkles className="w-4 h-4" /> AI ANALYSIS
              </button>
              <button onClick={addDrill} className="flex items-center gap-2 px-4 py-2 bg-sky-500 text-slate-900 font-bold rounded-xl hover:bg-white transition-all">
                <Plus className="w-4 h-4" /> ADD DRILL
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-700">
            <table className="w-full text-sm text-center">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-4 border-b border-slate-700" rowSpan={2}>NO</th>
                  <th className="p-4 border-b border-slate-700 text-left" rowSpan={2}>CATEGORY</th>
                  <th className="p-4 border-b border-slate-700 text-left" rowSpan={2}>DRILL ITEM</th>
                  <th className="p-4 border-b border-slate-700" rowSpan={2}>BASE</th>
                  <th className="p-4 border-b border-slate-700" rowSpan={2}>FACT</th>
                  <th className="p-4 border-b border-slate-700" rowSpan={2}>TOTAL</th>
                  <th className="p-4 border-b border-slate-700" colSpan={6}>WEEKLY DISTRIBUTION (RAW)</th>
                  <th className="p-4 border-b border-slate-700" rowSpan={2}></th>
                </tr>
                <tr>
                  {DAYS.map((day, i) => (
                    <th key={day} className="p-2 border-b border-slate-700">
                      {day.slice(0, 3)}
                      <span className="block text-[10px] text-sky-500">{PERCENTS[i]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {drills.map((drill, idx) => (
                  <tr key={drill.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-slate-500">{idx + 1}</td>
                    <td className="p-2">
                      <input 
                        type="text" value={drill.category} 
                        onChange={(e) => updateDrill(drill.id, 'category', e.target.value)}
                        placeholder="e.g. Physical"
                        className="bg-slate-900 border border-slate-700 p-2 rounded-lg w-full text-slate-300"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="text" value={drill.name} 
                        onChange={(e) => updateDrill(drill.id, 'name', e.target.value)}
                        placeholder="e.g. Bench Press"
                        className="bg-slate-900 border border-slate-700 p-2 rounded-lg w-full text-slate-300"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" value={drill.base} 
                        onChange={(e) => updateDrill(drill.id, 'base', Number(e.target.value))}
                        className="bg-slate-900 border border-slate-700 p-2 rounded-lg w-16 text-center"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" value={drill.fact} 
                        onChange={(e) => updateDrill(drill.id, 'fact', Number(e.target.value))}
                        className="bg-slate-900 border border-slate-700 p-2 rounded-lg w-16 text-center text-sky-400 font-bold"
                      />
                    </td>
                    <td className="p-2 text-sky-400 font-bold">{drill.total}</td>
                    {drill.dailyValues.map((v, i) => (
                      <td key={i} className="p-2 text-slate-300">{v}</td>
                    ))}
                    <td className="p-4">
                      <button onClick={() => removeDrill(drill.id)} className="text-rose-500 hover:text-rose-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!drills.length && (
              <div className="p-10 text-center text-slate-500 italic">No drills added. Click "ADD DRILL" to begin.</div>
            )}
          </div>
        </div>

        {/* Section 2: Daily Breakdown */}
        <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-slate-700 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-orbitron font-bold text-sky-400 flex items-center gap-2">
              <span className="bg-sky-500/20 p-2 rounded-lg">2</span> DAILY BREAKDOWN & TARGETS
            </h2>
            <button onClick={generateDailyPlan} className="flex items-center gap-2 px-6 py-2 bg-sky-500/10 text-sky-400 border border-sky-500/30 rounded-xl hover:bg-sky-500 hover:text-slate-950 transition-all font-bold">
              <RefreshCcw className="w-4 h-4" /> REFRESH DATA
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 text-slate-400 uppercase font-bold tracking-wider">
                <tr>
                  <th className="p-4 border-b border-slate-700 w-12 text-center">NO</th>
                  <th className="p-4 border-b border-slate-700 text-left">DRILL ITEM</th>
                  <th className="p-4 border-b border-slate-700 text-center">RAW VOL</th>
                  <th className="p-4 border-b border-slate-700 text-center text-sky-400">ROUNDED</th>
                  <th className="p-4 border-b border-slate-700 text-center">SETS / DUR</th>
                  <th className="p-4 border-b border-slate-700 text-center">REPS</th>
                  <th className="p-4 border-b border-slate-700 text-center">REST</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {sessionData.length === 0 ? (
                  <tr><td colSpan={7} className="p-10 text-center text-slate-500 italic">Click "REFRESH DATA" to generate.</td></tr>
                ) : (
                  // We group by Day then Category
                  DAYS.map(day => {
                    const daySessions = sessionData.filter(s => s.day === day);
                    if (!daySessions.length) return null;
                    return (
                      <React.Fragment key={day}>
                        <tr className="bg-sky-500/10"><td colSpan={7} className="p-3 font-bold text-sky-400 text-left px-6 tracking-widest">{day.toUpperCase()}</td></tr>
                        {daySessions.map((s, i) => (
                          <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="p-4 text-center text-slate-500">{i + 1}</td>
                            <td className="p-4 font-medium">{s.drill} <span className="text-[10px] text-slate-500 ml-2">({s.category})</span></td>
                            <td className="p-4 text-center">{Math.round(s.repsPerSet * (parseFloat(s.targetSets) || 1))}</td>
                            <td className="p-4 text-center text-sky-400 font-bold">{Math.round((s.repsPerSet * (parseFloat(s.targetSets) || 1))/10)*10}</td>
                            <td className="p-4 text-center">
                              <input 
                                type="text" value={s.targetSets} 
                                onChange={(e) => updateSessionTarget(s.id, e.target.value)}
                                className="bg-slate-900 border border-slate-700 w-16 text-center rounded-lg p-1 text-sky-400 font-bold"
                              />
                            </td>
                            <td className="p-4 text-center font-bold text-slate-200">{s.repsPerSet}</td>
                            <td className="p-4 text-center">
                              <input 
                                type="text" value={s.rest} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSessionData(prev => prev.map(sd => sd.id === s.id ? {...sd, rest: val} : sd));
                                }}
                                className="bg-slate-900 border border-slate-700 w-20 text-center rounded-lg p-1 text-slate-400"
                              />
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Session Plan Builder */}
        <div className="bg-slate-900/40 backdrop-blur-md rounded-3xl border border-sky-500/30 p-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-orbitron font-bold text-sky-400 flex items-center gap-2">
                <span className="bg-sky-500/20 p-2 rounded-lg">3</span> SESSION PLAN BUILDER
              </h2>
              <select 
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="bg-slate-900 text-white border border-sky-500/30 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-sky-500/50"
              >
                {DAYS.map(day => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sessionData.filter(s => s.day === selectedDay).map(s => {
              const key = `${selectedDay}-${s.id}`;
              const vars = variations[key] || [];
              const totalSetsAssigned = vars.reduce((acc, v) => acc + (Number(v.sets) || 0), 0);
              const target = Number(s.targetSets) || 0;
              const remaining = target - totalSetsAssigned;

              return (
                <div key={s.id} className="bg-slate-800/40 border border-slate-700 rounded-2xl p-5 hover:border-sky-500/40 transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-sky-400 text-lg">{s.drill}</h3>
                      <div className="flex gap-2 text-[10px] mt-1">
                        <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700">CAT: {s.category}</span>
                        <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-sky-400">TARGET: {s.targetSets} Sets</span>
                        <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-sky-400">REPS: {s.repsPerSet}</span>
                        <span className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-amber-500 font-bold">REST: {s.rest}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Remaining Sets</div>
                      <div className={`text-2xl font-black ${remaining === 0 ? 'text-emerald-500' : remaining > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                        {remaining}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <table className="w-full text-xs text-left">
                      <thead className="text-slate-500 uppercase border-b border-slate-700">
                        <tr>
                          <th className="pb-2">VARIATION NAME</th>
                          <th className="pb-2 w-16 text-center">SETS</th>
                          <th className="pb-2 w-16 text-center">REPS</th>
                          <th className="pb-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {vars.map(v => (
                          <tr key={v.id}>
                            <td className="py-2 pr-2">
                              <input 
                                type="text" value={v.name}
                                onChange={(e) => updateVariation(s.id, v.id, 'name', e.target.value)}
                                placeholder="Specific drill variant..."
                                className="bg-slate-900 border border-slate-700 w-full p-1.5 rounded-lg text-slate-300"
                              />
                            </td>
                            <td className="py-2 text-center">
                              <input 
                                type="number" value={v.sets}
                                onChange={(e) => updateVariation(s.id, v.id, 'sets', e.target.value)}
                                className="bg-slate-900 border border-slate-700 w-12 p-1.5 rounded-lg text-center font-bold text-sky-400"
                              />
                            </td>
                            <td className="py-2 text-center text-slate-400">{v.reps}</td>
                            <td className="py-2 text-right">
                              <button onClick={() => removeVariation(s.id, v.id)} className="text-slate-600 hover:text-rose-500">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button 
                      onClick={() => addVariation(s.id, s.repsPerSet)}
                      className="w-full py-2 bg-slate-900 border border-dashed border-slate-600 rounded-xl text-slate-500 hover:text-sky-400 hover:border-sky-500/40 transition-all text-xs font-bold uppercase flex items-center justify-center gap-2"
                    >
                      <Plus className="w-3 h-3" /> Add Variation
                    </button>
                  </div>
                </div>
              );
            })}
            {sessionData.filter(s => s.day === selectedDay).length === 0 && (
              <div className="col-span-2 p-12 text-center bg-slate-800/20 rounded-3xl border border-dashed border-slate-700 text-slate-600">
                No session data for {selectedDay}. Add drills in the table above first.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-orbitron text-sky-400 animate-pulse tracking-widest">PROCESSING DATA...</p>
        </div>
      )}
    </div>
  );

  // Router
  if (view === 'landing') return <LandingView />;
  if (view === 'login') return <LoginView />;
  return <DashboardView />;
};

// UI Components
const FeatureCard: React.FC<{ icon: React.ReactNode, title: string, desc: string }> = ({ icon, title, desc }) => (
  <div className="bg-slate-900/40 backdrop-blur-lg p-8 rounded-3xl border border-slate-800 hover:border-sky-500/50 transition-all duration-300 group cursor-default">
    <div className="mb-4 transform group-hover:scale-110 transition-transform">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
  </div>
);

const ActionBtn: React.FC<{ onClick: () => void, icon: React.ReactNode, label: string, variant: 'sky' | 'slate' | 'danger' }> = ({ onClick, icon, label, variant }) => {
  const styles = {
    sky: 'bg-sky-500 text-slate-950 hover:bg-white',
    slate: 'bg-slate-700 text-white hover:bg-slate-600',
    danger: 'bg-rose-500/20 text-rose-500 border border-rose-500/30 hover:bg-rose-500 hover:text-white'
  };
  return (
    <button onClick={onClick} className={`${styles[variant]} px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-xs transition-all`}>
      {icon} {label}
    </button>
  );
};

export default App;
