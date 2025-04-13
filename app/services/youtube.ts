import axios from 'axios';

interface VideoInfo {
    title: string;
    url: string;
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
    try {
    // Extrair o ID do vídeo da URL
    const videoId = url.match(/(?:v=|\/)[\w-]{11}(?:\?|&|$)/)?.[1];
    if (!videoId) {
        throw new Error('URL do YouTube inválida');
    }

    // Fazer a requisição para a API do YouTube
    const response = await axios.get(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${process.env.YOUTUBE_API_KEY}`
    );

    if (!response.data.items?.length) {
        throw new Error('Vídeo não encontrado');
    }

    const videoTitle = response.data.items[0].snippet.title;
    return {
        title: videoTitle,
        url: url
    };
    } catch (error) {
    console.error('Erro ao buscar informações do vídeo:', error);
    throw new Error('Erro ao buscar informações do vídeo');
    }
}