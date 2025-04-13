package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

type DownloadRequest struct {
	URL    string `json:"url"`
	Title  string `json:"title"`
	Format string `json:"format"`
}

type DownloadProgress struct {
	ID       string  `json:"id"`
	Progress float64 `json:"progress"`
	Status   string  `json:"status"`
	FilePath string  `json:"filePath"`
}

type DownloadWorker struct {
	requestChan  chan DownloadRequest
	progressChan chan DownloadProgress
	wg           *sync.WaitGroup
}

func NewDownloadWorker(requestChan chan DownloadRequest, progressChan chan DownloadProgress, wg *sync.WaitGroup) *DownloadWorker {
	return &DownloadWorker{
		requestChan:  requestChan,
		progressChan: progressChan,
		wg:          wg,
	}
}

func (w *DownloadWorker) Start() {
	go func() {
		defer w.wg.Done()
		for req := range w.requestChan {
			// Criar diretório de downloads se não existir
			downloadsDir := "downloads"
			if err := os.MkdirAll(downloadsDir, 0755); err != nil {
				log.Printf("Erro ao criar diretório de downloads: %v", err)
				continue
			}

			// Sanitizar e definir nome do arquivo
			sanitizedTitle := sanitizeFileName(req.Title)
			fileName := fmt.Sprintf("%s.%s", sanitizedTitle, req.Format)
			filePath := filepath.Join(downloadsDir, fileName)

			// Iniciar download
			w.progressChan <- DownloadProgress{
				ID:       req.URL,
				Progress: 0,
				Status:   fmt.Sprintf("Iniciando download de %s", req.Title),
				FilePath: filePath,
			}

			// Preparar comando yt-dlp
			args := []string{
				"--no-warnings",
				"--progress",
				"--newline",
			}

			if req.Format == "mp3" {
				args = append(args, "-x", "--audio-format", "mp3", "--audio-quality", "0")
			} else {
				args = append(args, "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best")
			}

			args = append(args, "-o", filePath, req.URL)
			cmd := exec.Command("yt-dlp", args...)

			// Capturar saída do comando
			stderr, err := cmd.StderrPipe()
			if err != nil {
				log.Printf("Erro ao criar pipe: %v", err)
				continue
			}

			// Iniciar comando
			if err := cmd.Start(); err != nil {
				log.Printf("Erro ao iniciar download: %v", err)
				continue
			}

			// Ler progresso
			scanner := bufio.NewScanner(stderr)
			for scanner.Scan() {
				line := scanner.Text()
				if strings.Contains(line, "%") {
					progress := parseProgress(line)
					w.progressChan <- DownloadProgress{
						ID:       req.URL,
						Progress: progress,
						Status:   fmt.Sprintf("Baixando %s... %.1f%%", req.Title, progress),
						FilePath: filePath,
					}
				}
			}

			// Aguardar conclusão
			if err := cmd.Wait(); err != nil {
				log.Printf("Erro durante o download: %v", err)
				continue
			}

			// Verificar se arquivo foi criado
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				log.Printf("Arquivo não foi criado: %v", err)
				continue
			}

			// Notificar conclusão
			w.progressChan <- DownloadProgress{
				ID:       req.URL,
				Progress: 100,
				Status:   fmt.Sprintf("Download concluído: %s", filePath),
				FilePath: filePath,
			}
		}
	}()
}

func parseProgress(line string) float64 {
	re := regexp.MustCompile(`([0-9.]+)%`)
	matches := re.FindStringSubmatch(line)
	if len(matches) > 1 {
		progress, err := strconv.ParseFloat(matches[1], 64)
		if err == nil {
			return progress
		}
	}
	return 0
}

func sanitizeFileName(fileName string) string {
	// Remover caracteres especiais e espaços extras
	reg := regexp.MustCompile(`[^a-zA-Z0-9]+`)
	// Substituir caracteres especiais por underline
	sanitized := reg.ReplaceAllString(fileName, "_")
	// Remover underlines múltiplos
	sanitized = regexp.MustCompile(`_+`).ReplaceAllString(sanitized, "_")
	// Remover underlines do início e fim
	sanitized = strings.Trim(sanitized, "_")
	return sanitized
}

func enableCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	requestChan := make(chan DownloadRequest, 100)
	progressChan := make(chan DownloadProgress, 100)
	var wg sync.WaitGroup

	// Iniciar workers
	numWorkers := 3
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		worker := NewDownloadWorker(requestChan, progressChan, &wg)
		worker.Start()
	}

	// Handler para iniciar downloads
	http.HandleFunc("/api/download", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Método não permitido", http.StatusMethodNotAllowed)
			return
		}

		var requests []DownloadRequest
		if err := json.NewDecoder(r.Body).Decode(&requests); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Enviar requisições para o canal
		for _, req := range requests {
			requestChan <- req
		}

		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]string{"status": "Downloads iniciados"})
	}))

	// Handler para SSE (Server-Sent Events) para progresso
	http.HandleFunc("/api/progress", enableCORS(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming não suportado", http.StatusInternalServerError)
			return
		}

		for progress := range progressChan {
			data, _ := json.Marshal(progress)
			fmt.Fprintf(w, "data: %s\n\n", data)
			flusher.Flush()
		}
	}))

	log.Println("Servidor iniciado na porta 8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}