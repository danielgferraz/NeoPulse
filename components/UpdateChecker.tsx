import React, { useState } from 'react';
import { checkForUpdates } from '../services/updateService';
import pkg from '../package.json';

const UpdateChecker: React.FC = () => {
    const [status, setStatus] = useState<
        'idle' | 'checking' | 'available' | 'up-to-date' | 'error'
    >('idle');
    const [downloadUrl, setDownloadUrl] = useState('');
    const [newVersion, setNewVersion] = useState('');

    const handleCheck = async () => {
        setStatus('checking');
        const info = await checkForUpdates(pkg.version);

        if (info.hasUpdate) {
            setStatus('available');
            setDownloadUrl(info.downloadUrl);
            setNewVersion(info.latestVersion);
        } else {
            setStatus('up-to-date');
            setTimeout(() => setStatus('idle'), 3000);
        }
    };

    return (
        <div className="w-full mt-4 p-4 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
            <div className="flex flex-col">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    Versão {pkg.version}
                </span>
                <span className="text-sm font-black text-zinc-300 uppercase">
                    {status === 'checking' && 'Verificando...'}
                    {status === 'available' && `Nova Versão: ${newVersion}`}
                    {status === 'up-to-date' && 'App Atualizado'}
                    {status === 'idle' && 'Atualizações'}
                    {status === 'error' && 'Erro ao verificar'}
                </span>
            </div>

            {status === 'available' ? (
                <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#00FF41] text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110"
                >
                    Baixar
                </a>
            ) : (
                <button
                    onClick={handleCheck}
                    disabled={status === 'checking'}
                    className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-400 active:scale-95 disabled:opacity-50"
                >
                    <i className={`fa-solid fa-rotate ${status === 'checking' ? 'fa-spin' : ''}`}></i>
                </button>
            )}
        </div>
    );
};

export default UpdateChecker;
