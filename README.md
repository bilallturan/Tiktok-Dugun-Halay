# TikTok canlı yayın halay oyunları

TikTok LIVE için iki etkileşimli oyun. İzleyiciler yorum yazarak, beğeni ve hediye atarak oyuna katılır.

- **canli-dugun**: düğün oyunu (2B). Halay halkası, gelin, damat, takı.
- **sira-gecesi**: sıra gecesi (3B, hamam böcekleri). Sahnede orkestra, ortada çiğ köfte, etrafında halay, yanlarda masalar.

Oyun bilgisayarında bir web sayfası olarak çalışır. Küçük bir sunucu, yayındaki yorum, beğeni ve hediyeleri [tiktok-live-connector](https://github.com/zerodytrash/TikTok-Live-Connector) ile okur ve oyuna iletir. Sayfayı TikTok LIVE Studio'da pencere yakalamayla yayına verirsin.

## Hızlı kurulum

1. [Node.js](https://nodejs.org) (LTS) kur.
2. [Euler Stream](https://www.eulerstream.com)'den ücretsiz API anahtarı al.
3. Oyun klasöründeki `ayarlar.json`'a TikTok kullanıcı adını ve anahtarı yaz.
4. `hediyeler.json`'da hediyeleri kendine göre ayarla.
5. `BASLAT.bat`'a çift tıkla.
6. TikTok LIVE Studio'da **Pencere yakalama** ile sahne penceresini seç, yayını aç.

Adım adım anlatım ve sorun çözme: **[KURULUM.md](KURULUM.md)**

Kendi müziklerini her oyunun `müzik` klasörüne atabilirsin.
