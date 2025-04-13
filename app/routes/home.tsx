import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { toast } from "react-hot-toast";
import { getVideoInfo } from "../services/youtube";
import { startDownloads, subscribeToProgress } from "../services/download";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "YouTube Downloader" },
    { name: "description", content: "Baixe vídeos do YouTube em MP3 ou MP4" },
  ];
}

export default function Home() {
  interface VideoLink {
    url: string;
    title: string;
  }

  const [links, setLinks] = useState<VideoLink[]>([]);
  const [currentLink, setCurrentLink] = useState("");
  const [format, setFormat] = useState("mp3");
  const [downloadState, setDownloadState] = useState({
    isDownloading: false,
    progress: 0,
    status: ""
  });

  const [isConfirming, setIsConfirming] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<{ url: string; title: string } | null>(null);

  const addLink = async () => {
    if (!currentLink.trim()) return;
    try {
      const videoInfo = await getVideoInfo(currentLink);
      const newVideo = { url: currentLink, title: videoInfo.title };
      setLinks(prevLinks => [...prevLinks, newVideo]);
      setCurrentLink("");
      toast.success("Vídeo adicionado com sucesso!");
    } catch (error) {
      toast.error("Erro ao verificar o vídeo");
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    if (downloadState.isDownloading) {
      unsubscribe = subscribeToProgress((progress) => {
        setDownloadState(prev => ({
          ...prev,
          progress: progress.progress,
          status: progress.status
        }));
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [downloadState.isDownloading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (links.length === 0) {
      toast.error("Adicione pelo menos um link para download");
      return;
    }

    try {
      setDownloadState({
        isDownloading: true,
        progress: 0,
        status: "Iniciando download..."
      });

      const downloads = links.map(link => ({
        url: link.url,
        title: link.title,
        format
      }));

      await startDownloads(downloads);
    } catch (error) {
      toast.error("Erro ao iniciar os downloads");
      setDownloadState({
        isDownloading: false,
        progress: 0,
        status: ""
      });
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800 dark:text-gray-200">
        Download de Vídeos do YouTube
      </h1>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-2">
          <label
            htmlFor="links"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
          >
            Links do YouTube
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={currentLink}
              onChange={(e) => setCurrentLink(e.target.value)}
              placeholder="Cole aqui o link do vídeo"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <button
              type="button"
              onClick={addLink}
              disabled={!currentLink.trim() || isConfirming}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors cursor-pointer transform hover:scale-105 transition-transform duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              +
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {links.map((link, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{link.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{link.url}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, i) => i !== index))}
                  className="text-red-500 hover:text-red-700 transform hover:scale-105 transition-transform duration-200 cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            Formato
          </label>
          <div className="flex gap-4">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                value="mp3"
                checked={format === "mp3"}
                onChange={(e) => setFormat(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">MP3</span>
            </label>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="radio"
                value="mp4"
                checked={format === "mp4"}
                onChange={(e) => setFormat(e.target.value)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-gray-700 dark:text-gray-300">MP4</span>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={downloadState.isDownloading || links.length === 0}
          className={`w-full ${downloadState.isDownloading || links.length === 0 ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'} text-white py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors transform hover:scale-105 transition-transform duration-200 disabled:opacity-50`}
        >
          {downloadState.isDownloading ? 'Baixando...' : 'Baixar'}
        </button>
      </form>

      {downloadState.isDownloading && (
        <div className="mt-6 max-w-2xl mx-auto">
          <div className="mb-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{downloadState.status}</span>
            <span>{downloadState.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${downloadState.progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </main>
  );
}
