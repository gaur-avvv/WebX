package config

import (
	"os"
)

type Config struct {
	Port            string
	KafkaBrokers    []string
	RedisURL        string
	JWTSecret       string
	AppEnv          string
	LogLevel        string
}

func Load() *Config {
	return &Config{
		Port:         getEnv("PORT", "4003"),
		KafkaBrokers: []string{os.Getenv("KAFKA_BROKERS")},
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		AppEnv:       getEnv("APP_ENV", "development"),
		LogLevel:     getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}
