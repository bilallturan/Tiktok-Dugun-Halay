# Kurulum: TikTok canlı yayın halay oyunları

Bu klasörde iki oyun var:

| Klasör | Oyun | Adres |
|---|---|---|
| `canli-dugun` | Düğün oyunu (2B): halay halkası, gelin, damat, takı | http://localhost:3000 |
| `sira-gecesi` | Sıra gecesi (3B, hamam böcekleri): orkestra, çiğ köfte, halay, masalar | http://localhost:3100 |

İkisi de aynı şekilde kurulur. Aşağıdaki adımlar Windows içindir.

---

## 1. Kodları indir

GitHub sayfasında yeşil **Code** düğmesine bas, **Download ZIP** ile indir. ZIP dosyasına sağ tıkla, **Tümünü ayıkla** de.

## 2. Node.js kur

https://nodejs.org adresinden **LTS** sürümünü indir ve kur (hep "İleri" demen yeterli).

Kontrol etmek için: Başlat menüsüne `cmd` yaz, açılan pencereye `node -v` yaz. `v20` veya üstü bir sürüm görüyorsan tamam.

## 3. Euler Stream'den ücretsiz API anahtarı al

Oyun, TikTok yayınındaki yorum, beğeni ve hediyeleri **tiktok-live-connector** kütüphanesiyle okur. Bu kütüphanenin bağlanabilmesi için bir imza anahtarı gerekiyor.

1. https://www.eulerstream.com adresine git, ücretsiz üye ol.
2. Panelden yeni bir API anahtarı oluştur.
3. `euler_` ile başlayan anahtarı kopyala.

## 4. `ayarlar.json` dosyasını doldur

Kullanacağın oyunun klasöründeki `ayarlar.json` dosyasını aç.

> **VS Code gerekmez.** Dosyaya sağ tıkla → **Birlikte aç** → **Not Defteri**. Windows'ta Not Defteri zaten yüklü. (İstersen VS Code ile de açabilirsin, renkli gösterir ama şart değil.)

Dosya şöyle görünür:

```json
{
  "username": "",
  "signApiKey": ""
}
```

Kullanıcı adını ve anahtarı **tırnakların arasına** yaz:

```json
{
  "username": "kullanici_adin",
  "signApiKey": "euler_xxxxxxxxxxxx"
}
```

- **username**: TikTok kullanıcı adın, başında `@` olmadan.
- **signApiKey**: 3. adımda aldığın Euler anahtarı.

> ⚠️ **Tırnakları silme.** Yazdığın şey iki tırnağın `"..."` arasında kalmalı. Satır sonundaki virgülü de silme.
>
> ✅ Doğru: `"username": "kullanici_adin",`
> ❌ Yanlış: `"username": kullanici_adin,` (tırnaklar silinmiş, oyun ayarları okuyamaz)

Kaydet (**Ctrl + S**) ve kapat. **Bu dosyayı kimseyle paylaşma**, anahtar sana özel.

> Kullanıcı adını istersen dosyaya yazmadan, oyunun kontrol panelinden de girebilirsin.

## 5. Hediyeleri kendine göre ayarla (`hediyeler.json`)

Hangi hediyenin ne yapacağı bu dosyada yazıyor. Bunu da Not Defteri ile açabilirsin. Değiştirirken yine tırnakları, virgülleri ve süslü parantezleri silme. Örnek (sıra gecesi):

```json
{ "eylem": "cigkofte", "etiket": "Çiğ Köfteci Ol", "jeton": 1, "ikon": "🌹", "ad": ["Rose", "Gül"], "id": ["5655"] }
```

- **eylem**: hediye gelince ne olacağı. Bunu değiştirme, dosyanın başında olası eylemler yazıyor.
- **etiket**: ekranda görünen ad.
- **jeton**: hediyenin jeton değeri. Hediye bu değerle eşleşir.
- **ad / id**: hediyenin TikTok'taki adı ve numarası (biliyorsan). Boş bırakırsan sadece jetona göre eşleşir.

TikTok LIVE Studio'da **İzleyici Dilekleri** kısmında hangi hediyeleri seçtiysen, buraya da aynı hediyeleri ve jeton değerlerini yaz. Böylece izleyici ekranın üstünde gördüğü hediyeyi atınca oyun tepki verir.

Dosyayı kaydedip oyun sayfasını yenilemen yeterli.

## 6. Müziklerini ekle

Oyun klasöründeki `müzik` klasörüne kendi müziklerini at (mp3, m4a, wav, ogg…). Hepsi sırayla, tekrar tekrar çalar. Oyun şarkının ritmini ölçüp halayın hızını ona göre ayarlar.

## 7. Başlat

Oyun klasöründeki **`BASLAT.bat`** dosyasına çift tıkla.

- İlk açılışta gerekli paketleri kendisi kurar (1-2 dakika).
- Siyah bir **SUNUCU** penceresi açılır. **Yayın boyunca bunu kapatma.**
- Kenarlıksız, dikey bir **sahne penceresi** açılır. Yayına verilecek pencere bu.
- Normal tarayıcıda **kontrol paneli** açılır: bağlantı durumu, demo düğmeleri, hediye kaydı. Bunu yayına verme.

Yayın açmadan denemek için kontrol panelindeki demo düğmelerini kullanabilirsin. Hesap bağlanınca demo kendiliğinden kapanır.

## 8. TikTok LIVE Studio'da yayına ver

1. TikTok LIVE Studio'yu aç, sahneyi **dikey (9:16)** yap.
2. **Kaynak ekle → Pencere yakalama** seç.
3. Oyunun **sahne penceresini** seç, sahneyi kaplayacak şekilde büyüt.
4. Yayını başlat. Oyun yayına kendisi bağlanır. Yayın kapalıyken bekler, yayın açılınca otomatik bağlanır.

---

## Oyunda izleyici ne yapabilir?

**Sıra gecesi**

| İzleyici | Oyunda |
|---|---|
| Yayına girer | Masaya oturur (ilk gelenler sazcı, solist, darbukacı, çiğ köfteci olur) |
| "Halaya katıl" yazar | Halaya girer |
| "kadın" / "erkek" yazar | Karakteri değişir |
| "oyna" yazar | Zıplar |
| Beğeni atar | Halay hızlanır |
| Hediye atar | `hediyeler.json`'daki eylem olur (çiğ köfteci, solist, herkese çay…) |

Yayın boşken beş sabit halaycı döner, gerçek izleyiciler geldikçe yer açarlar. Salon dolarsa en uzun süredir sessiz duran kişi yerini yeni gelene bırakır.

## Sorun çıkarsa

| Belirti | Çözüm |
|---|---|
| "Node.js bulunamadı" | 2. adım. Kurduktan sonra bilgisayarı yeniden başlat. |
| "... requires a Business plan" | Kodda `enableExtendedGiftInfo` kapalı olmalı (bu pakette kapalı gelir). |
| "rate limit" hatası | Ücretsiz Euler anahtarının saatlik sınırı doldu. Biraz bekle; program kendisi tekrar dener. |
| "şu an yayında değil" | Yayın açık değil. Yayını açınca 30 saniye içinde kendisi bağlanır. |
| SUNUCU penceresinde "ayarlar" / JSON hatası | `ayarlar.json`'da bir tırnak veya virgül silinmiş. 4. adımdaki örneğe göre düzelt. |
| Sayfa açılmıyor | SUNUCU penceresi kapanmış olabilir. `BASLAT.bat`'a tekrar çift tıkla. |
| Müzik çalmıyor | `müzik` klasöründe dosya var mı bak. Sahne penceresine bir kez tıkla. |
