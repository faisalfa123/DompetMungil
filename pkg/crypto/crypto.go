package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"os"
	"path/filepath"
)

// GenerateOrLoadKey memuat atau membuat AES-256 key (32 bytes) dari file rahasia lokal
func GenerateOrLoadKey(keyPath string) ([]byte, error) {
	if _, err := os.Stat(keyPath); err == nil {
		data, err := os.ReadFile(keyPath)
		if err != nil {
			return nil, err
		}
		if len(data) != 32 {
			return nil, errors.New("panjang kunci enkripsi tidak valid (wajib 32 bytes)")
		}
		return data, nil
	}

	// Buat direktori jika belum ada
	dir := filepath.Dir(keyPath)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0700); err != nil {
			return nil, err
		}
	}

	// Generate 32 bytes acak
	key := make([]byte, 32)
	if _, err := io.ReadFull(rand.Reader, key); err != nil {
		return nil, err
	}

	// Tulis dengan hak akses 0600 (hanya bisa dibaca oleh pemilik proses)
	if err := os.WriteFile(keyPath, key, 0600); err != nil {
		return nil, err
	}

	return key, nil
}

// EncryptText mengenkripsi string menggunakan AES-256-GCM (Authenticated Encryption)
func EncryptText(plainText string, key []byte) (string, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	cipherBytes := gcm.Seal(nonce, nonce, []byte(plainText), nil)
	return base64.StdEncoding.EncodeToString(cipherBytes), nil
}

// DecryptText mendekripsi string terenkripsi dengan AES-256-GCM
func DecryptText(cipherText string, key []byte) (string, error) {
	data, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("ciphertext rusak atau terlalu pendek")
	}

	nonce, actualCipher := data[:nonceSize], data[nonceSize:]
	plainBytes, err := gcm.Open(nil, nonce, actualCipher, nil)
	if err != nil {
		return "", errors.New("gagal dekripsi: data tidak valid atau kunci berbeda")
	}

	return string(plainBytes), nil
}
