document.addEventListener("DOMContentLoaded", function () {
    // 📌 CKEditor Başlatma Modülü
    initCKEditor();
    
    // 📌 SEO Analiz Butonunu Dinle
    initSeoAnalysisButton();
});

// 📌 CKEditor Başlatma Fonksiyonu
function initCKEditor() {
    const editorElement = document.querySelector("#editor");

    if (!editorElement) {
        console.error("❌ CKEditor öğesi bulunamadı!");
        return;
    }

    ClassicEditor
        .create(editorElement, {
            extraPlugins: [CustomUploadAdapterPlugin],
            heading: {
                options: [
                    { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                    { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                    { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
                ]
            }
        })
        .then(editor => {
            window.editorInstance = editor;
            console.log("✅ CKEditor başarıyla yüklendi.");
        })
        .catch(error => {
            console.error("❌ CKEditor yüklenirken hata oluştu:", error);
        });
}

// 📌 CKEditor için Özel Görsel Yükleme Adaptörü
class CustomUploadAdapter {
    constructor(loader) {
        this.loader = loader;
    }

    upload() {
        return this.loader.file
            .then(file => new Promise((resolve, reject) => {
                const data = new FormData();
                data.append("file", file);

                fetch("/upload-image/", {
                    method: "POST",
                    body: data
                })
                .then(response => response.json())
                .then(result => {
                    if (result.url) {
                        resolve({ default: result.url });
                    } else {
                        reject("❌ Görsel yüklenirken hata oluştu!");
                    }
                })
                .catch(error => {
                    console.error("❌ Görsel yükleme hatası:", error);
                    reject("⚠️ Görsel yüklenirken bilinmeyen bir hata oluştu.");
                });
            }));
    }
}

function CustomUploadAdapterPlugin(editor) {
    editor.plugins.get("FileRepository").createUploadAdapter = loader => {
        return new CustomUploadAdapter(loader);
    };
}

// 📌 SEO Analiz Butonunu Dinleme Fonksiyonu
function initSeoAnalysisButton() {
    const analyzeBtn = document.getElementById("analyzeBtn");
    if (!analyzeBtn) {
        console.warn("⚠️ SEO Analiz butonu bulunamadı!");
        return;
    }
    
    analyzeBtn.addEventListener("click", performSeoAnalysis);
}

// 📌 SEO Analizi Gerçekleştirme
function performSeoAnalysis() {
    const title = document.getElementById("title").value.trim();
    const metaDesc = document.getElementById("meta_desc").value.trim();
    const content = window.editorInstance ? window.editorInstance.getData().trim() : "";
    
    resetSeoUI();

    if (!title || !metaDesc || !content) {
        alert("⚠️ Lütfen başlık, meta açıklaması ve içerik alanlarını doldurun!");
        return;
    }

    const formData = new URLSearchParams();
    formData.append("title", title);
    formData.append("meta_desc", metaDesc);
    formData.append("content", content);

    fetch("/content-analysis/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
    })
    .then(response => response.json())
    .then(data => handleSeoAnalysisResponse(data))
    .catch(error => handleSeoAnalysisError(error));
}

// 📌 SEO UI'ı Sıfırlama
function resetSeoUI() {
    document.getElementById("seoScore").innerText = "0";
    document.getElementById("seoStatus").innerText = "Analiz ediliyor...";
    document.getElementById("progressCircle").style.strokeDashoffset = "377"; // Tam çember
}

// 📌 SEO Analiz Yanıtını İşleme
function handleSeoAnalysisResponse(data) {
    if (!data || typeof data !== "object") {
        console.error("❌ Sunucudan geçersiz yanıt alındı!");
        return;
    }
    
    const seoScore = calculateSeoScore(data);
    updateSeoScore(seoScore);

    document.getElementById("analysisResult").classList.remove("d-none");

    // Analiz sonuçlarını güncelle
    updateSuccessList(data);
    updateSuggestionList(data);
    updateImprovementList(data);
    updateErrorList(data);
    updateImageAnalysis(data);
    updateMetrics(data);
    
    // SEO İyileştirme Önerileri Butonunu Ekle
    addSeoImprovementButton(seoScore);
}

// 📌 SEO Analiz Hatasını İşleme
function handleSeoAnalysisError(error) {
    console.error("❌ SEO Analizi yapılırken hata oluştu:", error);
    let errorContainer = document.getElementById("errors");
    if (errorContainer) {
        errorContainer.innerHTML = `<li class="text-danger">🚨 Sunucu hatası! Lütfen daha sonra tekrar deneyin.</li>`;
    }
}

// 📌 Başarı Listesini Güncelleme
function updateSuccessList(data) {
    let successContainer = document.getElementById("successes");
    if (!successContainer) return;
    
    successContainer.innerHTML = "";
    let successList = [];
    
    if (data.title_length >= 50) successList.push("✅ Başlık uzunluğu yeterli!");
    if (data.meta_desc_length >= 120) successList.push("✅ Meta açıklaması uygun!");
    if (data.word_count >= 300) successList.push("✅ İçerik uzunluğu yeterli!");
    if (data.h2_count >= 2) successList.push("✅ H2 başlık sayısı ideal!");
    if (data.alt_analysis && data.alt_analysis.status === "Tamam") successList.push("✅ Tüm görseller ALT metnine sahip!");

    successContainer.innerHTML = successList.length
        ? successList.map(msg => `<li class="text-success">${msg}</li>`).join("")
        : `<li class="text-warning">⚠️ İyileştirme önerilerini ve hatalarınızı kontrol ediniz!</li>`;
}

// 📌 Öneri Listesini Güncelleme
function updateSuggestionList(data) {
    let suggestionContainer = document.getElementById("suggestions");
    if (!suggestionContainer) return;
    
    let suggestions = data.recommendations ? data.recommendations.filter(rec =>
        !rec.includes("olmalıdır") && !rec.includes("eksik") && !rec.includes("hata")
    ) : [];
    
    suggestionContainer.innerHTML = suggestions.length
        ? suggestions.map(msg => `<li class="text-primary">🧷 ${msg}</li>`).join("")
        : "<li class='text-success'>✅ Herhangi bir iyileştirme önerisi bulunamadı!</li>";
}

// 📌 İyileştirme Listesini Güncelleme
function updateImprovementList(data) {
    let improvementContainer = document.getElementById("improvements");
    if (!improvementContainer) return;
    
    let improvements = data.recommendations ? data.recommendations.filter(rec => 
        rec.includes("olmalıdır")
    ) : [];
    
    improvementContainer.innerHTML = improvements.length
        ? improvements.map(msg => `<li class="text-warning">⚠️ ${msg}</li>`).join("")
        : "<li class='text-success'>✅ Her şey yolunda, yapılması gereken bir işlem bulunamadı!</li>";
}

// 📌 Hata Listesini Güncelleme
function updateErrorList(data) {
    let errorContainer = document.getElementById("errors");
    if (!errorContainer) return;
    
    let errors = data.recommendations ? data.recommendations.filter(rec =>
        rec.includes("eksik") || rec.includes("hata") || rec.includes("yanlış")
    ) : [];

    // Görsel Yoksa Hata Olarak Ekle
    if (data.image_count === 0) {
        errors.push("🚨 İçeriğinizde hiç görsel bulunmuyor! En az bir görsel eklemelisiniz.");
    }

    errorContainer.innerHTML = errors.length
        ? errors.map(msg => `<li class="text-danger">❌ ${msg}</li>`).join("")
        : "<li class='text-success'>✅ Harika! Herhangi bir hata tespit edilmedi!</li>";
}

// 📌 Görsel Analiz Sonuçlarını Güncelleme
function updateImageAnalysis(data) {
    // ALT Metni Uyarıları
    let altWarning = document.getElementById("altWarning");
    if (altWarning) {
        if (data.alt_analysis && data.alt_analysis.status === "Eksik ALT") {
            altWarning.classList.remove("d-none");
            altWarning.innerHTML = `<li class="text-danger">⚠️ ${data.alt_analysis.message}</li>`;
        } 
        else if (data.alt_analysis && data.alt_analysis.status === "no_images") {
            altWarning.classList.remove("d-none");
            altWarning.innerHTML = `<li class="text-danger">⚠️ ${data.alt_analysis.message}</li>`;
        } 
        else {
            altWarning.classList.add("d-none");
        }
    }

    // Görsel Detay Sonuçları
    let imageResultsContainer = document.getElementById("imageResults");
    if (!imageResultsContainer || !data.image_analysis) return;
    
    imageResultsContainer.innerHTML = ""; // Önceki sonuçları temizle

    data.image_analysis.forEach((img) => {
        let imgSrc = img.file_path ? img.file_path : "https://via.placeholder.com/100x60?text=Görsel+Bulunamadı"; 

        // Eğer analiz bilgisi yoksa, boş değerler atayalım
        let imgAnalysis = img.analysis || {
            format: "Bilinmiyor",
            file_size_kb: "?",
            file_size_mb: "?",
            size_status: "Bilinmiyor",
            format_status: "Bilinmiyor"
        };

        let resultHTML = `
            <div class="alert alert-info">
                <h5>📊 ${img.file_name || "Bilinmeyen Görsel"}</h5>
                ${img.error ? `<p class="text-danger">${img.error}</p>` : ""}
                <ul>
                    <li>📁 <strong>Görsel Yolu:</strong> <a href="${imgSrc}" target="_blank">${img.file_name}</a></li>
                    <li>📁 <strong>Format:</strong> ${imgAnalysis.format}</li>
                    <li>📏 <strong>Dosya Boyutu:</strong> ${imgAnalysis.file_size_kb} KB / ${imgAnalysis.file_size_mb} MB</li>
                    <li>📌 <strong>Boyut Durumu:</strong> ${imgAnalysis.size_status}</li>
                    <li>🖼️ <strong>Format Durumu:</strong> ${imgAnalysis.format_status}</li>
                </ul>
            </div>
        `;

        imageResultsContainer.innerHTML += resultHTML;
    });
}

// 📌 Metrikleri Güncelleme
function updateMetrics(data) {
    // Ana Sayaçları Güncelle
    updateTextContent("title_length", data.title_length);
    updateTextContent("word_count", data.word_count);
    updateTextContent("meta_desc_length", data.meta_desc_length);
    updateTextContent("image_count", data.image_count);

    // Okunabilirlik Skoru
    if (data.readability_score !== undefined) {
        updateTextContent("readability_score", data.readability_score.toFixed(2));
    }

    // Anahtar Kelime Dağılımı
    if (data.keyword_density) {
        updateTextContent("keyword_density", data.keyword_density.map(k => `${k[0]} (${k[1]} kez)`).join(", "));
    }

    // Ortalama Cümle Uzunluğu
    if (data.sentence_lengths && data.sentence_lengths.length > 0) {
        let avgSentenceLength = (data.sentence_lengths.reduce((a, b) => a + b, 0) / data.sentence_lengths.length).toFixed(2);
        updateTextContent("sentence_length", avgSentenceLength);
    }

    // Duygu Analizi
    if (data.sentiment) {
        updateTextContent("sentiment", data.sentiment);
    }

    // Renk Değişimi
    updateCardColor("word_count", data.word_count, 300, 1000);
    updateCardColor("title_length", data.title_length, 50, 60);
    updateCardColor("meta_desc_length", data.meta_desc_length, 120, 160);
    updateCardColor("image_count", data.image_count, 1, 5);
}

// 📌 ID Kontrolü ve Güncelleme Fonksiyonu
function updateTextContent(id, value) {
    let element = document.getElementById(id);
    if (element) {
        element.textContent = value || "-";
    } else {
        console.warn(`⚠ ID bulunamadı: ${id}`);
    }
}

// 📌 Kart Rengini Güncelleme
function updateCardColor(id, value, min, max) {
    const element = document.getElementById(id);

    if (!element || isNaN(value)) {
        console.warn(`⚠ updateCardColor: "${id}" için geçersiz değer!`);
        return;
    }

    element.classList.remove("text-success", "text-warning", "text-danger");

    if (value < min) {
        element.classList.add("text-danger"); // Kırmızı - Yetersiz
    } else if (value >= min && value <= max) {
        element.classList.add("text-success"); // Yeşil - İdeal
    } else {
        element.classList.add("text-warning"); // Sarı - Fazla
    }
}

// 📌 SEO Skorunu Hesaplama
function calculateSeoScore(data) {
    let score = 0;
    let maxPossibleScore = 0;
    let detailedScores = {};

    // 📌 Başlık Değerlendirmesi (Daha esnek puanlama)
    if (data.title_length >= 50 && data.title_length <= 65) {
        score += 20;
        detailedScores.title = { puan: 20, durum: "Mükemmel", mesaj: "Başlık uzunluğu ideal aralıkta!" };
    } else if (data.title_length >= 40 && data.title_length < 50) {
        score += 15;
        detailedScores.title = { puan: 15, durum: "İyi", mesaj: "Başlık uzunluğu kabul edilebilir aralıkta." };
    } else if (data.title_length >= 30 && data.title_length < 40) {
        score += 10;
        detailedScores.title = { puan: 10, durum: "Orta", mesaj: "Başlık biraz kısa, uzatmayı düşünebilirsiniz." };
    } else if (data.title_length > 65 && data.title_length <= 75) {
        score += 10;
        detailedScores.title = { puan: 10, durum: "Orta", mesaj: "Başlık biraz uzun, kısaltmayı düşünebilirsiniz." };
    } else if (data.title_length > 0) {
        score += 5;
        detailedScores.title = { puan: 5, durum: "Zayıf", mesaj: "Başlık uzunluğu ideal değil." };
    } else {
        detailedScores.title = { puan: 0, durum: "Eksik", mesaj: "Başlık bulunamadı!" };
    }
    maxPossibleScore += 20;

    // 📌 Meta Açıklaması Değerlendirmesi (Daha esnek puanlama)
    if (data.meta_desc_length >= 120 && data.meta_desc_length <= 160) {
        score += 20;
        detailedScores.metaDesc = { puan: 20, durum: "Mükemmel", mesaj: "Meta açıklaması ideal uzunlukta!" };
    } else if (data.meta_desc_length >= 100 && data.meta_desc_length < 120) {
        score += 15;
        detailedScores.metaDesc = { puan: 15, durum: "İyi", mesaj: "Meta açıklaması kabul edilebilir uzunlukta." };
    } else if (data.meta_desc_length > 160 && data.meta_desc_length <= 180) {
        score += 15;
        detailedScores.metaDesc = { puan: 15, durum: "İyi", mesaj: "Meta açıklaması biraz uzun ama kabul edilebilir." };
    } else if (data.meta_desc_length >= 80 && data.meta_desc_length < 100) {
        score += 10;
        detailedScores.metaDesc = { puan: 10, durum: "Orta", mesaj: "Meta açıklaması biraz kısa." };
    } else if (data.meta_desc_length > 180 && data.meta_desc_length <= 200) {
        score += 10;
        detailedScores.metaDesc = { puan: 10, durum: "Orta", mesaj: "Meta açıklaması oldukça uzun." };
    } else if (data.meta_desc_length > 0) {
        score += 5;
        detailedScores.metaDesc = { puan: 5, durum: "Zayıf", mesaj: "Meta açıklaması ideal uzunlukta değil." };
    } else {
        detailedScores.metaDesc = { puan: 0, durum: "Eksik", mesaj: "Meta açıklaması bulunamadı!" };
    }
    maxPossibleScore += 20;

    // 📌 İçerik Uzunluğu Değerlendirmesi (Daha esnek puanlama)
    if (data.word_count >= 600) {
        score += 20;
        detailedScores.wordCount = { puan: 20, durum: "Mükemmel", mesaj: "İçerik uzunluğu çok iyi!" };
    } else if (data.word_count >= 400 && data.word_count < 600) {
        score += 18;
        detailedScores.wordCount = { puan: 18, durum: "Çok İyi", mesaj: "İçerik uzunluğu iyi seviyede." };
    } else if (data.word_count >= 300 && data.word_count < 400) {
        score += 15;
        detailedScores.wordCount = { puan: 15, durum: "İyi", mesaj: "İçerik uzunluğu yeterli." };
    } else if (data.word_count >= 200 && data.word_count < 300) {
        score += 10;
        detailedScores.wordCount = { puan: 10, durum: "Orta", mesaj: "İçerik biraz kısa, uzatmayı düşünebilirsiniz." };
    } else if (data.word_count >= 100 && data.word_count < 200) {
        score += 5;
        detailedScores.wordCount = { puan: 5, durum: "Zayıf", mesaj: "İçerik çok kısa, daha fazla bilgi ekleyin." };
    } else {
        detailedScores.wordCount = { puan: 0, durum: "Yetersiz", mesaj: "İçerik neredeyse yok denecek kadar az!" };
    }
    maxPossibleScore += 20;

    // 📌 H2 Başlık Sayısı Değerlendirmesi
    if (data.h2_count >= 3) {
        score += 15;
        detailedScores.h2Count = { puan: 15, durum: "Mükemmel", mesaj: "Alt başlık sayısı ideal!" };
    } else if (data.h2_count === 2) {
        score += 12;
        detailedScores.h2Count = { puan: 12, durum: "İyi", mesaj: "Alt başlık sayısı yeterli." };
    } else if (data.h2_count === 1) {
        score += 8;
        detailedScores.h2Count = { puan: 8, durum: "Orta", mesaj: "Daha fazla alt başlık eklemeyi düşünün." };
    } else {
        detailedScores.h2Count = { puan: 0, durum: "Eksik", mesaj: "Alt başlık (H2) kullanılmamış!" };
    }
    maxPossibleScore += 15;

    // 📌 Görsel Değerlendirmesi
    if (data.image_count >= 3) {
        score += 15;
        detailedScores.imageCount = { puan: 15, durum: "Mükemmel", mesaj: "Görsel sayısı ideal!" };
    } else if (data.image_count === 2) {
        score += 12;
        detailedScores.imageCount = { puan: 12, durum: "İyi", mesaj: "Görsel sayısı yeterli." };
    } else if (data.image_count === 1) {
        score += 8;
        detailedScores.imageCount = { puan: 8, durum: "Orta", mesaj: "Daha fazla görsel eklemeyi düşünün." };
    } else {
        detailedScores.imageCount = { puan: 0, durum: "Eksik", mesaj: "Hiç görsel kullanılmamış!" };
    }
    maxPossibleScore += 15;

    // 📌 ALT Metni Değerlendirmesi
    if (data.image_count > 0) {
        if (data.alt_analysis && data.alt_analysis.status === "Tamam") {
            score += 10;
            detailedScores.altText = { puan: 10, durum: "Mükemmel", mesaj: "Tüm görsellerde ALT metni var!" };
        } else if (data.alt_analysis && data.alt_analysis.status === "Eksik ALT") {
            score += 5;
            detailedScores.altText = { puan: 5, durum: "Eksik", mesaj: "Bazı görsellerde ALT metni eksik." };
        } else {
            detailedScores.altText = { puan: 0, durum: "Hata", mesaj: "ALT metni analizi yapılamadı." };
        }
        maxPossibleScore += 10;
    }

    // 📌 Okunabilirlik Skoru Değerlendirmesi
    if (data.readability_score !== undefined) {
        if (data.readability_score >= 60) {
            score += 10;
            detailedScores.readability = { puan: 10, durum: "Mükemmel", mesaj: "İçerik okunabilirliği çok iyi!" };
        } else if (data.readability_score >= 50 && data.readability_score < 60) {
            score += 8;
            detailedScores.readability = { puan: 8, durum: "İyi", mesaj: "İçerik okunabilirliği iyi." };
        } else if (data.readability_score >= 40 && data.readability_score < 50) {
            score += 6;
            detailedScores.readability = { puan: 6, durum: "Orta", mesaj: "İçerik okunabilirliği orta seviyede." };
        } else if (data.readability_score >= 30 && data.readability_score < 40) {
            score += 4;
            detailedScores.readability = { puan: 4, durum: "Zayıf", mesaj: "İçerik okunabilirliği düşük." };
        } else {
            score += 2;
            detailedScores.readability = { puan: 2, durum: "Çok Zayıf", mesaj: "İçerik okunabilirliği çok düşük!" };
        }
        maxPossibleScore += 10;
    }

    // 📌 Ortalama Cümle Uzunluğu Değerlendirmesi
    if (data.sentence_lengths && data.sentence_lengths.length > 0) {
        const avgSentenceLength = data.sentence_lengths.reduce((a, b) => a + b, 0) / data.sentence_lengths.length;
        
        if (avgSentenceLength >= 12 && avgSentenceLength <= 20) {
            score += 10;
            detailedScores.sentenceLength = { puan: 10, durum: "Mükemmel", mesaj: "Cümle uzunluğu ideal!" };
        } else if ((avgSentenceLength >= 10 && avgSentenceLength < 12) || (avgSentenceLength > 20 && avgSentenceLength <= 25)) {
            score += 7;
            detailedScores.sentenceLength = { puan: 7, durum: "İyi", mesaj: "Cümle uzunluğu kabul edilebilir." };
        } else if ((avgSentenceLength >= 8 && avgSentenceLength < 10) || (avgSentenceLength > 25 && avgSentenceLength <= 30)) {
            score += 4;
            detailedScores.sentenceLength = { puan: 4, durum: "Orta", mesaj: "Cümle uzunluğu ideal değil." };
        } else {
            score += 2;
            detailedScores.sentenceLength = { puan: 2, durum: "Zayıf", mesaj: "Cümle uzunluğu sorunlu!" };
        }
        maxPossibleScore += 10;
    }

    // 📌 Anahtar Kelime Kullanımı
    if (data.keyword_density && data.keyword_density.length > 0) {
        // En çok kullanılan kelimenin yoğunluğunu kontrol et
        const topKeyword = data.keyword_density[0];
        const keywordCount = topKeyword[1];
        const keywordDensity = keywordCount / data.word_count * 100;
        
        if (keywordDensity >= 1 && keywordDensity <= 3) {
            score += 10;
            detailedScores.keywordDensity = { puan: 10, durum: "Mükemmel", mesaj: "Anahtar kelime yoğunluğu ideal!" };
        } else if (keywordDensity > 0.5 && keywordDensity < 1) {
            score += 7;
            detailedScores.keywordDensity = { puan: 7, durum: "İyi", mesaj: "Anahtar kelime yoğunluğu kabul edilebilir." };
        } else if (keywordDensity > 3 && keywordDensity <= 5) {
            score += 5;
            detailedScores.keywordDensity = { puan: 5, durum: "Orta", mesaj: "Anahtar kelime yoğunluğu biraz fazla." };
        } else if (keywordDensity > 5) {
            score += 2;
            detailedScores.keywordDensity = { puan: 2, durum: "Zayıf", mesaj: "Anahtar kelime aşırı kullanılmış!" };
        } else {
            score += 3;
            detailedScores.keywordDensity = { puan: 3, durum: "Düşük", mesaj: "Anahtar kelime kullanımı yetersiz." };
        }
        maxPossibleScore += 10;
    }

    // 📌 Bonus Puanlar
    // İçerik 1000 kelimeden fazlaysa bonus puan
    if (data.word_count >= 1000) {
        score += 5;
        detailedScores.bonusLength = { puan: 5, durum: "Bonus", mesaj: "Uzun ve detaylı içerik bonusu!" };
        maxPossibleScore += 5;
    }

    // H3 başlıklar kullanılmışsa bonus puan
    if (data.h3_count && data.h3_count > 0) {
        score += 5;
        detailedScores.bonusH3 = { puan: 5, durum: "Bonus", mesaj: "H3 başlık kullanım bonusu!" };
        maxPossibleScore += 5;
    }

    // Hata yoksa bonus puan
    if (data.errors && Array.isArray(data.errors) && data.errors.length === 0) {
        score += 5;
        detailedScores.bonusNoErrors = { puan: 5, durum: "Bonus", mesaj: "Hatasız içerik bonusu!" };
        maxPossibleScore += 5;
    }

    // Toplam skoru hesapla (100 üzerinden)
    const finalScore = maxPossibleScore > 0 ? Math.round((score / maxPossibleScore) * 100) : 0;
    
    // Detaylı skor bilgilerini sakla (ileride kullanılabilir)
    window.seoDetailedScores = detailedScores;
    
    // Skor 0-100 arasında olmalı
    return Math.min(Math.max(finalScore, 0), 100);
}

// 📌 SEO Skorunu Güncelleme ve Animasyon
function updateSeoScore(score) {
    let progressCircle = document.getElementById("progressCircle");
    let seoScoreText = document.getElementById("seoScore");
    let seoStatus = document.getElementById("seoStatus");
    let scoreDetailsContainer = document.getElementById("scoreDetailsContainer");

    if (!progressCircle || !seoScoreText || !seoStatus) {
        console.error("❌ SEO skor gösterge elemanları bulunamadı!");
        return;
    }

    // Skoru 0-100 arasında sınırla
    score = Math.min(Math.max(score, 0), 100);

    // 📌 Skoru sıfırla ve yeniden başlat
    seoScoreText.innerText = "0"; // Önce sıfırlıyoruz
    let maxDashArray = 377;
    let scorePercentage = (maxDashArray * (100 - score)) / 100;

    // 🌈 Renk Geçişi ve Glow Efekti
    let color, statusText, glowColor;
    if (score >= 80) {
        color = "#28a745"; // Yeşil (Harika)
        glowColor = "rgba(40, 167, 69, 0.7)";
        statusText = "Harika!";
    } else if (score >= 50) {
        color = "#ffc107"; // Sarı (İdare Eder)
        glowColor = "rgba(255, 193, 7, 0.7)";
        statusText = "İdare Eder";
    } else {
        color = "#dc3545"; // Kırmızı (Zayıf)
        glowColor = "rgba(220, 53, 69, 0.7)";
        statusText = "Zayıf";
    }

    progressCircle.style.transition = "stroke-dashoffset 1.2s ease-out, stroke 0.5s ease-in-out";
    progressCircle.style.stroke = color;
    progressCircle.style.filter = `drop-shadow(0px 0px 12px ${glowColor})`;
    progressCircle.style.strokeDashoffset = scorePercentage;

    // 📌 SEO Puanı Artışı Animasyonu
    animateTextUpdate(seoScoreText, 0, score);
    seoStatus.innerText = statusText;
    
    // 📌 Puanlama Detaylarını Göster
    if (scoreDetailsContainer) {
        updateScoreDetailsSection(scoreDetailsContainer);
    } else {
        // Eğer container yoksa oluştur
        createScoreDetailsSection();
    }
}

// 📌 Puanlama Detayları Bölümünü Güncelle
function updateScoreDetailsSection(container) {
    if (!window.seoDetailedScores) {
        container.innerHTML = `
            <p class="text-center text-muted small">Puanlama detayları için SEO analizi yapılmalıdır.</p>
        `;
        return;
    }
    
    // Başlık ve açıklama
    let detailsHTML = `
        <h5 class="fw-bold text-center mb-3">📊 Puanlama Detayları</h5>
        <p class="text-muted text-center mb-3">SEO puanınız aşağıdaki kriterlere göre hesaplanmıştır:</p>
    `;
    
    // Kriter isimleri
    const criteriaNames = {
        title: "Başlık Uzunluğu",
        metaDesc: "Meta Açıklaması",
        wordCount: "İçerik Uzunluğu",
        h2Count: "H2 Başlık Sayısı",
        imageCount: "Görsel Sayısı",
        altText: "ALT Metni",
        readability: "Okunabilirlik",
        sentenceLength: "Cümle Uzunluğu",
        keywordDensity: "Anahtar Kelime Yoğunluğu",
        bonusLength: "Bonus: Uzun İçerik",
        bonusH3: "Bonus: H3 Başlık",
        bonusNoErrors: "Bonus: Hatasız İçerik"
    };
    
    // Durum renklerini belirle
    const statusColors = {
        "Mükemmel": "success",
        "Çok İyi": "success",
        "İyi": "primary",
        "Orta": "info",
        "Zayıf": "warning",
        "Çok Zayıf": "warning",
        "Eksik": "danger",
        "Yetersiz": "danger",
        "Hata": "danger",
        "Düşük": "warning",
        "Bonus": "success"
    };
    
    // Kriterleri kartlara ekle
    detailsHTML += `<div class="row row-cols-1 row-cols-md-3 g-3 mb-3">`;
    
    // Her kriteri kart olarak ekle
    for (const [key, details] of Object.entries(window.seoDetailedScores)) {
        if (criteriaNames[key]) {
            const statusClass = statusColors[details.durum] || "secondary";
            detailsHTML += `
                <div class="col">
                    <div class="card shadow-sm border-0 h-100">
                        <div class="card-body p-3">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="card-title mb-0">${criteriaNames[key]}</h6>
                                <span class="badge bg-${statusClass}">${details.durum}</span>
                            </div>
                            <p class="card-text small text-muted mb-2">${details.mesaj}</p>
                            <div class="text-end">
                                <span class="badge bg-light text-dark">${details.puan} puan</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    }
    
    detailsHTML += `</div>`;
    
    // Puanlama açıklamasını ekle
    detailsHTML += `
        <div class="card shadow-sm border-0 rounded-4 p-3">
            <div class="card-header bg-transparent border-0 pb-0">
                <h5 class="fw-bold">📝 Puanlama Kriterleri</h5>
            </div>
            <div class="card-body pt-2">
                <p class="text-muted mb-3">SEO puanınız, yukarıdaki kriterlerin her biri için aldığınız puanların toplamının, maksimum olası puana bölünmesiyle hesaplanır.</p>
                <div class="row">
                    <div class="col-md-6">
                        <ul class="small mb-0">
                            <li><strong>Başlık:</strong> 50-65 karakter arası ideal (20p)</li>
                            <li><strong>Meta Açıklama:</strong> 120-160 karakter arası ideal (20p)</li>
                            <li><strong>İçerik:</strong> 600+ kelime ideal (20p)</li>
                            <li><strong>H2 Başlık:</strong> 3+ başlık ideal (15p)</li>
                            <li><strong>Görsel:</strong> 3+ görsel ideal (15p)</li>
                        </ul>
                    </div>
                    <div class="col-md-6">
                        <ul class="small mb-0">
                            <li><strong>ALT Metni:</strong> Tüm görsellerde olmalı (10p)</li>
                            <li><strong>Okunabilirlik:</strong> 60+ puan ideal (10p)</li>
                            <li><strong>Cümle Uzunluğu:</strong> 12-20 kelime arası ideal (10p)</li>
                            <li><strong>Anahtar Kelime:</strong> %1-3 arası ideal (10p)</li>
                            <li><strong>Bonus Puanlar:</strong> Uzun içerik, H3 başlık ve hatasız içerik (5p)</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = detailsHTML;
}

// 📌 Puanlama Detayları Bölümünü Oluştur
function createScoreDetailsSection() {
    // Puanlama detayları için container oluştur
    const container = document.createElement("div");
    container.id = "scoreDetailsContainer";
    container.className = "container mt-4 animate-fade-in";
    
    // Puanlama detaylarını güncelle
    updateScoreDetailsSection(container);
    
    // Analiz sonuçları bölümüne ekle
    const analysisResult = document.getElementById("analysisResult");
    if (analysisResult) {
        analysisResult.appendChild(container);
    }
}

// 📌 SEO Puanı Artışı Animasyonu
function animateTextUpdate(element, start, end) {
    if (!element) return;
    
    // Başlangıç ve bitiş değerlerini kontrol et
    start = parseInt(start) || 0;
    end = parseInt(end) || 0;
    
    // Değerler aynıysa animasyon yapmaya gerek yok
    if (start === end) {
        element.innerText = end;
        return;
    }
    
    let duration = 800; // 0.8 saniye
    let range = Math.abs(end - start);
    let stepTime = range > 0 ? Math.floor(duration / range) : 50;
    
    // Minimum adım süresini sağla
    stepTime = Math.max(stepTime, 10);
    
    let current = start;
    let increment = end > start ? 1 : -1;

    let timer = setInterval(function () {
        current += increment;
        element.innerText = current;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            clearInterval(timer);
            element.innerText = end; // Son değeri kesin olarak ayarla
        }
    }, stepTime);
}

// 📌 API'den SEO Analizini Çek ve Güncelle
function fetchSeoAnalysis() {
    fetch("/content-analysis/", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include"
    })
    .then(response => response.json())
    .then(data => {
        if (!data || typeof data !== "object") {
            console.error("❌ Sunucudan geçersiz yanıt alındı!");
            return;
        }

        let seoScore = calculateSeoScore(data);
        updateSeoScore(seoScore);
    })
    .catch(error => {
        console.error("🚨 SEO Analizi yapılırken hata oluştu:", error);
    });
}

// 📌 SEO İyileştirme Önerileri Butonu Ekleme
function addSeoImprovementButton(score) {
    // Eğer skor 80'den düşükse iyileştirme butonu göster
    if (score < 80) {
        const container = document.querySelector(".d-flex.flex-column.align-items-center.my-4");
        
        if (container) {
            // Eğer buton zaten varsa kaldır
            const existingButton = document.getElementById("seoImprovementBtn");
            if (existingButton) {
                existingButton.remove();
            }
            
            // Yeni buton oluştur
            const button = document.createElement("button");
            button.id = "seoImprovementBtn";
            button.className = "btn btn-primary mt-3 animate-pulse";
            button.innerHTML = "🚀 SEO Puanınızı Nasıl Yükseltebilirsiniz?";
            button.addEventListener("click", showSeoImprovementModal);
            
            // Butonu ekle
            container.appendChild(button);
        }
    }
}

// 📌 SEO İyileştirme Modalını Gösterme
function showSeoImprovementModal() {
    // Detaylı puanlama bilgilerini al
    const detailedScores = window.seoDetailedScores;
    if (!detailedScores) {
        alert("⚠️ SEO analiz bilgileri bulunamadı!");
        return;
    }
    
    // Düşük puanlı kriterleri bul (10 puan ve altı)
    const lowScoreCriteria = [];
    const criteriaNames = {
        title: "Başlık Uzunluğu",
        metaDesc: "Meta Açıklaması",
        wordCount: "İçerik Uzunluğu",
        h2Count: "H2 Başlık Sayısı",
        imageCount: "Görsel Sayısı",
        altText: "ALT Metni",
        readability: "Okunabilirlik",
        sentenceLength: "Cümle Uzunluğu",
        keywordDensity: "Anahtar Kelime Yoğunluğu"
    };
    
    for (const [key, details] of Object.entries(detailedScores)) {
        if (criteriaNames[key] && details.puan <= 10) {
            lowScoreCriteria.push({
                key: key,
                name: criteriaNames[key],
                puan: details.puan,
                durum: details.durum,
                mesaj: details.mesaj
            });
        }
    }
    
    // İyileştirme önerilerini hazırla
    const improvementSuggestions = {
        title: {
            title: "Başlık Uzunluğu Optimizasyonu",
            description: "Başlık, SEO'nun en önemli faktörlerinden biridir. Google arama sonuçlarında tam olarak görüntülenmesi için ideal başlık uzunluğu 50-65 karakter arasındadır.",
            suggestions: [
                "Başlığınızda mutlaka hedef anahtar kelimenizi kullanın",
                "Başlığı 50-65 karakter arasında tutun",
                "Başlığınızı ilgi çekici ve tıklanabilir yapın",
                "Başlığınızda sayılar ve özel karakterler kullanmayı deneyin (örn: '5 Etkili Yöntem')",
                "Başlığınızda soru ifadeleri kullanmayı deneyin (örn: 'Nasıl...?')"
            ],
            examples: [
                "❌ Kötü: 'SEO'",
                "❌ Kötü: 'SEO Hakkında Bilmeniz Gereken Her Şey ve Daha Fazlası - 2023 Yılında Güncel SEO Teknikleri ve Stratejileri'",
                "✅ İyi: '2023'te SEO Başarısı İçin 7 Kanıtlanmış Strateji'"
            ]
        },
        metaDesc: {
            title: "Meta Açıklaması Optimizasyonu",
            description: "Meta açıklaması, arama sonuçlarında başlığın altında görünen kısa açıklamadır. İdeal uzunluk 120-160 karakter arasındadır.",
            suggestions: [
                "Meta açıklamanızda hedef anahtar kelimenizi kullanın",
                "Açıklamayı 120-160 karakter arasında tutun",
                "İçeriğinizi özetleyen, değer vaat eden bir açıklama yazın",
                "Kullanıcıyı harekete geçiren ifadeler kullanın (örn: 'Hemen öğrenin', 'Keşfedin')",
                "Benzersiz meta açıklamaları yazın, içeriği kopyalamaktan kaçının"
            ],
            examples: [
                "❌ Kötü: 'SEO hakkında bilgiler'",
                "❌ Kötü: 'Bu sayfada SEO teknikleri, SEO stratejileri, SEO araçları ve daha fazlası hakkında detaylı bilgiler bulabilirsiniz. SEO çalışmalarınızı geliştirmek için okuyun.'",
                "✅ İyi: 'SEO puanınızı 30 günde %40 artıracak kanıtlanmış 5 stratejiyi keşfedin. Uzman önerileri ve adım adım rehberle hemen başlayın!'"
            ]
        },
        wordCount: {
            title: "İçerik Uzunluğu Optimizasyonu",
            description: "Kapsamlı ve detaylı içerikler, Google tarafından daha değerli görülür. İdeal içerik uzunluğu konuya göre değişse de, genellikle 600+ kelime önerilir.",
            suggestions: [
                "Konuyu derinlemesine ele alın, en az 600 kelime kullanın",
                "İçeriği alt başlıklara bölerek okumayı kolaylaştırın",
                "Gereksiz kelime doldurmaktan kaçının, her paragraf değer sunmalı",
                "Listeleri ve madde işaretlerini kullanarak içeriği daha okunabilir yapın",
                "Konuyla ilgili tüm soruları yanıtlamaya çalışın"
            ],
            examples: [
                "❌ Kötü: 100-200 kelimelik yüzeysel içerik",
                "✅ İyi: 600+ kelimelik, alt başlıklarla organize edilmiş, değerli bilgiler içeren içerik"
            ]
        },
        h2Count: {
            title: "H2 Başlık Kullanımı",
            description: "H2 başlıklar, içeriğinizi bölümlere ayırır ve hem kullanıcılar hem de arama motorları için yapıyı netleştirir. İdeal olarak en az 3 H2 başlık kullanılmalıdır.",
            suggestions: [
                "İçeriğinizi mantıklı bölümlere ayırın ve her bölüm için H2 başlık kullanın",
                "H2 başlıklarınızda anahtar kelimeler kullanın",
                "Başlıkları soru formatında kullanmayı deneyin",
                "Başlıkları hiyerarşik olarak kullanın (H1 > H2 > H3)",
                "Her H2 başlık altında en az 100 kelimelik içerik oluşturun"
            ],
            examples: [
                "❌ Kötü: Hiç H2 başlık kullanmamak veya sadece 1 tane kullanmak",
                "✅ İyi: 'SEO Nedir?', 'SEO'nun Önemi', 'SEO Teknikleri', 'Sık Sorulan Sorular' gibi başlıklar kullanmak"
            ]
        },
        imageCount: {
            title: "Görsel Kullanımı",
            description: "Görseller, içeriğinizi daha çekici hale getirir ve kullanıcı deneyimini iyileştirir. İdeal olarak her 300 kelime için en az 1 görsel kullanılmalıdır.",
            suggestions: [
                "İçeriğinizle ilgili, yüksek kaliteli görseller kullanın",
                "Her görsele ALT metni ekleyin",
                "Görselleri optimize edin (boyut ve format)",
                "İnfografikler, grafikler veya diyagramlar kullanarak karmaşık bilgileri basitleştirin",
                "Özgün görseller kullanmaya çalışın, stok fotoğraflardan kaçının"
            ],
            examples: [
                "❌ Kötü: Hiç görsel kullanmamak veya ilgisiz görseller kullanmak",
                "✅ İyi: İçerikle ilgili, açıklayıcı ve optimize edilmiş görseller kullanmak"
            ]
        },
        altText: {
            title: "ALT Metni Optimizasyonu",
            description: "ALT metni, görsellerin açıklamasıdır ve görsel yüklenemediğinde veya ekran okuyucular tarafından okunduğunda kullanılır. Ayrıca, Google'ın görseli anlamasına yardımcı olur.",
            suggestions: [
                "Her görsele açıklayıcı ALT metni ekleyin",
                "ALT metninde anahtar kelime kullanın (aşırıya kaçmadan)",
                "Görselin içeriğini doğru şekilde tanımlayın",
                "ALT metnini 125 karakterden kısa tutun",
                "Dekoratif görseller için boş ALT metni kullanın (alt=\"\")"
            ],
            examples: [
                "❌ Kötü: ALT metni olmayan görseller veya 'resim1.jpg' gibi anlamsız ALT metinleri",
                "❌ Kötü: 'seo, anahtar kelime, optimizasyon, google, arama motoru' gibi anahtar kelime yığını",
                "✅ İyi: 'Google arama sonuçları sayfasında organik sıralamanın gösterildiği ekran görüntüsü'"
            ]
        },
        readability: {
            title: "Okunabilirlik İyileştirmesi",
            description: "Okunabilirlik, içeriğinizin ne kadar kolay anlaşıldığını gösterir. Yüksek okunabilirlik skoru, daha geniş bir kitleye ulaşmanızı sağlar.",
            suggestions: [
                "Kısa cümleler ve paragraflar kullanın",
                "Basit ve anlaşılır bir dil kullanın",
                "Teknik terimleri açıklayın",
                "Aktif ses kullanın (pasif yerine)",
                "Madde işaretleri ve numaralandırılmış listeler kullanın",
                "İçeriği mantıklı bir akışla düzenleyin"
            ],
            examples: [
                "❌ Kötü: 'Söz konusu optimizasyon süreçlerinin implementasyonu esnasında algoritmaların davranışsal paternlerinin analizi elzemdir.'",
                "✅ İyi: 'SEO çalışmalarında, Google'ın nasıl çalıştığını anlamak önemlidir.'"
            ]
        },
        sentenceLength: {
            title: "Cümle Uzunluğu Optimizasyonu",
            description: "İdeal cümle uzunluğu 12-20 kelime arasındadır. Çok uzun cümleler okumayı zorlaştırır, çok kısa cümleler ise akıcılığı bozabilir.",
            suggestions: [
                "Uzun cümleleri bölerek daha kısa cümleler oluşturun",
                "Cümle uzunluklarını çeşitlendirin",
                "Bağlaçları azaltın",
                "Gereksiz kelimeleri çıkarın",
                "Bir cümlede bir fikir anlatın"
            ],
            examples: [
                "❌ Kötü: 'SEO, web sitelerinin arama motorlarında daha iyi sıralanması için yapılan çalışmaların tümünü kapsayan ve içerisinde teknik optimizasyon, içerik optimizasyonu, kullanıcı deneyimi iyileştirmeleri ve bağlantı kurma stratejileri gibi birçok farklı disiplini barındıran kapsamlı bir dijital pazarlama stratejisidir.'",
                "✅ İyi: 'SEO, web sitelerinin arama motorlarında daha iyi sıralanması için yapılan çalışmaların tümüdür. Bu çalışmalar teknik optimizasyon, içerik optimizasyonu ve bağlantı kurma stratejilerini içerir.'"
            ]
        },
        keywordDensity: {
            title: "Anahtar Kelime Yoğunluğu Optimizasyonu",
            description: "Anahtar kelime yoğunluğu, içeriğinizde hedef anahtar kelimenizin ne sıklıkta kullanıldığını gösterir. İdeal yoğunluk %1-3 arasındadır.",
            suggestions: [
                "Hedef anahtar kelimenizi başlıkta, ilk paragrafta ve son paragrafta kullanın",
                "Anahtar kelimenizi doğal bir şekilde metne yerleştirin",
                "Aşırı kullanımdan kaçının (keyword stuffing)",
                "Eş anlamlı kelimeler ve ilgili terimleri kullanın",
                "LSI (Latent Semantic Indexing) anahtar kelimeleri kullanın"
            ],
            examples: [
                "❌ Kötü: 'SEO önemlidir çünkü SEO ile siteniz üst sıralara çıkar. SEO yapmadan başarılı olamazsınız. SEO için SEO uzmanlarına danışın.'",
                "✅ İyi: 'Arama motoru optimizasyonu (SEO), web sitenizin görünürlüğünü artırır. İyi bir optimizasyon stratejisi, organik trafiğinizi yükseltebilir. Arama sıralamasında üst sıralara çıkmak için içerik kalitesine önem vermelisiniz.'"
            ]
        }
    };
    
    // Modal içeriğini oluştur
    let modalContent = `
        <div class="modal-header bg-primary text-white">
            <h5 class="modal-title">🚀 SEO Puanınızı Nasıl Yükseltebilirsiniz?</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Kapat"></button>
        </div>
        <div class="modal-body">
            <div class="alert alert-info">
                <h6 class="fw-bold">📊 SEO Puanınız: ${document.getElementById("seoScore").innerText}</h6>
                <p class="mb-0">Aşağıdaki öneriler, SEO puanınızı yükseltmenize yardımcı olacaktır.</p>
            </div>
            
            <div class="accordion" id="improvementAccordion">
    `;
    
    // Düşük puanlı kriterleri ekle
    lowScoreCriteria.forEach((criteria, index) => {
        const suggestion = improvementSuggestions[criteria.key];
        if (suggestion) {
            modalContent += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="heading${index}">
                        <button class="accordion-button ${index > 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse${index}" aria-expanded="${index === 0 ? 'true' : 'false'}" aria-controls="collapse${index}">
                        <span class="badge bg-warning me-2">${criteria.puan} puan</span> ${suggestion.title}
                    </button>
                </h2>
                <div id="collapse${index}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" aria-labelledby="heading${index}" data-bs-parent="#improvementAccordion">
                    <div class="accordion-body">
                        <p>${suggestion.description}</p>
                        <h6 class="fw-bold">🔍 Mevcut Durum:</h6>
                        <p class="text-${criteria.puan <= 5 ? 'danger' : 'warning'}">${criteria.mesaj}</p>
                        
                        <h6 class="fw-bold">💡 Öneriler:</h6>
                        <ul>
                            ${suggestion.suggestions.map(s => `<li>${s}</li>`).join('')}
                        </ul>
                        
                        <h6 class="fw-bold">📝 Örnekler:</h6>
                        <div class="bg-light p-3 rounded">
                            ${suggestion.examples.map(e => `<p class="mb-1">${e}</p>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        }
    });
    
    // Eğer düşük puanlı kriter yoksa genel öneriler ekle
    if (lowScoreCriteria.length === 0) {
        modalContent += `
            <div class="alert alert-success">
                <h6 class="fw-bold">✅ Tebrikler!</h6>
                <p class="mb-0">Tüm SEO kriterlerinde iyi bir performans gösteriyorsunuz. Puanınızı daha da yükseltmek için aşağıdaki genel önerileri uygulayabilirsiniz:</p>
            </div>
            <ul>
                <li>İçeriğinizi düzenli olarak güncelleyin</li>
                <li>Daha fazla iç bağlantı ekleyin</li>
                <li>Sayfa yükleme hızını optimize edin</li>
                <li>Mobil uyumluluğu iyileştirin</li>
                <li>Sosyal medya paylaşım butonları ekleyin</li>
                <li>Kullanıcı deneyimini iyileştirin</li>
            </ul>
        `;
    }
    
    modalContent += `
            </div>
        </div>
        <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Kapat</button>
            <button type="button" class="btn btn-primary" id="printSuggestions">🖨️ Önerileri Yazdır</button>
        </div>
    `;
    
    // Modal oluştur veya güncelle
    let modalElement = document.getElementById("seoImprovementModal");
    
    if (!modalElement) {
        // Modal yoksa oluştur
        modalElement = document.createElement("div");
        modalElement.id = "seoImprovementModal";
        modalElement.className = "modal fade";
        modalElement.tabIndex = "-1";
        modalElement.setAttribute("aria-labelledby", "seoImprovementModalLabel");
        modalElement.setAttribute("aria-hidden", "true");
        
        modalElement.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    ${modalContent}
                </div>
            </div>
        `;
        
        document.body.appendChild(modalElement);
    } else {
        // Modal varsa içeriğini güncelle
        const modalContentElement = modalElement.querySelector(".modal-content");
        if (modalContentElement) {
            modalContentElement.innerHTML = modalContent;
        }
    }
    
    // Modalı göster
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
    
    // Yazdırma butonuna olay dinleyicisi ekle
    const printButton = document.getElementById("printSuggestions");
    if (printButton) {
        printButton.addEventListener("click", function() {
            // Yazdırma işlevi
            const printWindow = window.open("", "_blank");
            
            if (printWindow) {
                printWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>SEO İyileştirme Önerileri</title>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
                            h1 { color: #0d6efd; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
                            h2 { color: #0d6efd; margin-top: 30px; }
                            h3 { margin-top: 20px; }
                            .section { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
                            .status { font-style: italic; color: #dc3545; }
                            ul { margin-bottom: 15px; }
                            .examples { background-color: #f8f9fa; padding: 15px; border-radius: 5px; }
                            .footer { margin-top: 50px; text-align: center; font-size: 0.8em; color: #6c757d; }
                        </style>
                    </head>
                    <body>
                        <h1>SEO İyileştirme Önerileri</h1>
                        <p>SEO Puanı: ${document.getElementById("seoScore").innerText}</p>
                        <p>Tarih: ${new Date().toLocaleDateString()}</p>
                `);
                
                // Düşük puanlı kriterleri ekle
                lowScoreCriteria.forEach(criteria => {
                    const suggestion = improvementSuggestions[criteria.key];
                    if (suggestion) {
                        printWindow.document.write(`
                            <div class="section">
                                <h2>${suggestion.title}</h2>
                                <p>${suggestion.description}</p>
                                
                                <h3>Mevcut Durum:</h3>
                                <p class="status">${criteria.mesaj}</p>
                                
                                <h3>Öneriler:</h3>
                                <ul>
                                    ${suggestion.suggestions.map(s => `<li>${s}</li>`).join('')}
                                </ul>
                                
                                <h3>Örnekler:</h3>
                                <div class="examples">
                                    ${suggestion.examples.map(e => `<p>${e}</p>`).join('')}
                                </div>
                            </div>
                        `);
                    }
                });
                
                // Eğer düşük puanlı kriter yoksa genel öneriler ekle
                if (lowScoreCriteria.length === 0) {
                    printWindow.document.write(`
                        <div class="section">
                            <h2>Genel SEO Önerileri</h2>
                            <p>Tebrikler! Tüm SEO kriterlerinde iyi bir performans gösteriyorsunuz. Puanınızı daha da yükseltmek için aşağıdaki genel önerileri uygulayabilirsiniz:</p>
                            <ul>
                                <li>İçeriğinizi düzenli olarak güncelleyin</li>
                                <li>Daha fazla iç bağlantı ekleyin</li>
                                <li>Sayfa yükleme hızını optimize edin</li>
                                <li>Mobil uyumluluğu iyileştirin</li>
                                <li>Sosyal medya paylaşım butonları ekleyin</li>
                                <li>Kullanıcı deneyimini iyileştirin</li>
                            </ul>
                        </div>
                    `);
                }
                
                printWindow.document.write(`
                        <div class="footer">
                            <p>Bu rapor VEMSEO.COM tarafından oluşturulmuştur.</p>
                        </div>
                    </body>
                    </html>
                `);
                
                printWindow.document.close();
                printWindow.print();
            }
        });
    }
}