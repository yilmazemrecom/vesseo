// 📌 Analiz Silme
function deleteAnalysis(analysisId) {
    if (confirm("Bu analizi silmek istediğinize emin misiniz?")) {
        fetch(`/admin/delete-analysis/${analysisId}`, {
            method: "DELETE",
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            location.reload(); // Sayfayı yenile
        })
        .catch(error => console.error("Silme işlemi başarısız!", error));
    }
}

// 📌 Düzenleme Modal'ını Aç
function openEditModal(id, title, metaDesc) {
    document.getElementById("editAnalysisId").value = id;
    document.getElementById("editTitle").value = title;
    document.getElementById("editMetaDesc").value = metaDesc;
}

// 📌 Analiz Güncelleme
document.getElementById("editForm").addEventListener("submit", function (event) {
    event.preventDefault();

    const analysisId = document.getElementById("editAnalysisId").value;
    const title = document.getElementById("editTitle").value;
    const metaDesc = document.getElementById("editMetaDesc").value;

    const formData = new URLSearchParams();
    formData.append("title", title);
    formData.append("meta_desc", metaDesc);

    fetch(`/admin/edit-analysis/${analysisId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString()
    })
    .then(response => response.json())
    .then(data => {
        alert(data.message);
        location.reload(); // Güncellenince sayfayı yenile
    })
    .catch(error => console.error("Düzenleme işlemi başarısız!", error));
});

// 📌 Eski Analizleri Silme
function deleteOldAnalyses() {
    const days = document.getElementById("daysInput").value;
    
    if (confirm(`${days} günden eski analizleri silmek istediğinize emin misiniz?`)) {
        fetch(`/admin/delete-old-analyses?days=${days}`, {
            method: "DELETE",
        })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            location.reload(); // Güncellenince sayfayı yenile
        })
        .catch(error => console.error("Silme işlemi başarısız!", error));
    }
}
