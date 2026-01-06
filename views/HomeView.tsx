import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useNavigate } from 'react-router-dom';

import UpdateChecker from '../components/UpdateChecker';

const HomeView: React.FC = () => {
    const trainings = useLiveQuery(() => db.trainings.orderBy('order').toArray());
    const navigate = useNavigate();

    const addTraining = async () => {
        const name = prompt("Nome do Treino (ex: Treino C - Pernas):");
        if (name) {
            await db.trainings.add({ name, order: (trainings?.length || 0) });
        }
    };

    return (
        <div className="w-full max-w-md flex flex-col gap-4 pb-20 animate-in fade-in">
            <div className="flex justify-between items-center mb-4 px-2">
                <h2 className="text-xl font-black uppercase italic tracking-tighter text-zinc-400">Meus Treinos</h2>
                <button onClick={addTraining} className="bg-[#00FF41] text-black w-8 h-8 rounded-lg flex items-center justify-center font-bold shadow-[0_0_10px_rgba(0,255,65,0.3)]">
                    <i className="fa-solid fa-plus"></i>
                </button>
            </div>

            <UpdateChecker />

            <div className="grid grid-cols-1 gap-3">
                {trainings?.map((training) => (
                    <div key={training.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl flex justify-between items-center group active:scale-[0.98] transition-transform">
                        <div onClick={() => navigate(`/session/${training.id}`)} className="flex-1 cursor-pointer">
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-md font-bold tracking-widest uppercase">Folder</span>
                            <h3 className="text-xl font-black text-white mt-1 uppercase italic">{training.name}</h3>
                            <p className="text-xs text-zinc-500 mt-1 font-bold">Toque para iniciar</p>
                        </div>

                        <div className="flex flex-col gap-2 border-l border-zinc-800 pl-4 ml-2">
                            <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/training/${training.id}`); }}
                                className="w-10 h-10 rounded-xl bg-zinc-950 text-zinc-400 border border-zinc-800 flex items-center justify-center hover:text-[#00FF41] hover:border-[#00FF41]"
                            >
                                <i className="fa-solid fa-pen-to-square"></i>
                            </button>
                        </div>
                    </div>
                ))}

                {trainings?.length === 0 && (
                    <div className="text-center p-10 opacity-50">
                        <i className="fa-solid fa-folder-open text-4xl mb-4"></i>
                        <p>Nenhum treino criado.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HomeView;
