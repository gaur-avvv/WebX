package websocket

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// In production, check the origin header
		return true
	},
}

func HandleWS(hub *Hub) gin.HandlerFunc {
	return func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade failed: %v", err)
			return
		}

		client := hub.Register(conn)
		log.Printf("New client connected: %v", client.Conn.RemoteAddr())

		// Read loop to keep connection alive and handle client messages
		go func() {
			defer func() {
				hub.Unregister(client)
				conn.Close()
			}()

			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
						log.Printf("WebSocket read error: %v", err)
					}
					break
				}
			}
		}()

		// Write loop to push updates from the hub to the client
		go func() {
			defer conn.Close()
			for message := range client.Send {
				err := conn.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("WebSocket write error: %v", err)
					break
				}
			}
		}()
	}
}
