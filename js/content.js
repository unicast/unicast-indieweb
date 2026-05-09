const modal = document.getElementById('content-modal');
const modalBody = document.getElementById('modal-body');
const closeModalBtn = document.getElementById('close-modal');
let isModalOpen = false;

closeModalBtn.addEventListener('click', () => {
    closeModal();
});

function openModal(markdownFile) {
    fetch(markdownFile)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.text();
        })
        .then(text => {
            modalBody.innerHTML = marked.parse(text);
            modal.classList.remove('hidden');
            isModalOpen = true;
        })
        .catch(error => {
            console.error('Error fetching markdown:', error);
            modalBody.innerHTML = '<p>Error loading content.</p>';
            modal.classList.remove('hidden');
            isModalOpen = true;
        });
}

function closeModal() {
    modal.classList.add('hidden');
    isModalOpen = false;
}
