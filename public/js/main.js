let currentUserId = null;

    function openTab(evt, tabName) {
        let i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tab-content");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }
        tablinks = document.getElementsByClassName("tab-button");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].className = tablinks[i].className.replace(" active", "");
        }
        document.getElementById(tabName).style.display = "block";
        evt.currentTarget.className += " active";

        if (tabName === 'historyContent') {
            showHistory();
        }
    }

    async function archiveCurrentConversation() {
        if (!currentUserId) return;
        if (!confirm('¿Estás seguro de que quieres archivar la conversación actual? Se iniciará una nueva.')) {
            return;
        }

        try {
            // Asume que existe un endpoint POST /archssistant/archive para archivar la conversación
            const res = await fetch('/archssistant/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Fallo al archivar la conversación');
            }

            const data = await res.json();
            alert(data.message || 'Conversación archivada.');

            document.getElementById('response').innerHTML = 'Conversación anterior archivada. ¡Comienza una nueva!';
            document.getElementById('userInput').value = '';
            
            openTab({currentTarget: document.getElementById('chatTabButton')}, 'chatContent');

        } catch (error) {
            alert(`⚠️ Error al archivar la conversación: ${error.message}`);
            console.error(error);
        }
    }

    async function enterChat() {
        const userNameInput = document.getElementById('initialUserName');
        const user = userNameInput.value.trim();
        if (!user) {
            alert('Por favor, ingresa un nombre de usuario.');
            return;
        }
        currentUserId = user;

        document.getElementById('userLogin').style.display = 'none';
        document.getElementById('chatInterface').style.display = 'block';
        openTab({currentTarget: document.getElementById('chatTabButton')}, 'chatContent');
        
        const responseBox = document.getElementById('response');
        responseBox.innerHTML = `Bienvenido, ${currentUserId}. Cargando tu sesión...`;

        try {
            const historyRes = await fetch(`/archssistant/history/${currentUserId}`);
            if (!historyRes.ok) throw new Error('Error fetching history');
            const historyData = await historyRes.json();
            
            const activeConversation = historyData.find(c => c.isActive);

            if (activeConversation) {
                const history = typeof activeConversation.history === 'string' 
                    ? JSON.parse(activeConversation.history) 
                    : activeConversation.history;

                if (history && history.length > 0) {
                    responseBox.innerHTML = ''; // Clear loading message
                    history.forEach(item => {
                        if (item.role === 'user') {
                            appendMessage(responseBox, `${currentUserId} >> ${item.content}`);
                        } else if (item.role === 'assistant') {
                            appendMessage(responseBox, `Archssistant >> ${item.content}\n`);
                        }
                    });
                } else {
                    responseBox.innerHTML = `Bienvenido, ${currentUserId}. No hay una conversación activa. ¡Haz tu primera pregunta!`;
                }
            } else {
                responseBox.innerHTML = `Bienvenido, ${currentUserId}. No hay una conversación activa. ¡Haz tu primera pregunta!`;
            }

        } catch (error) {
            responseBox.textContent = '⚠️ Error al cargar la sesión. Puedes empezar una nueva conversación.';
            console.error(error);
        }
    }

    async function askAI() {
      const userInput = document.getElementById('userInput');
      const message = userInput.value.trim();
      if (!message) return;

      const responseBox = document.getElementById('response');
      const loading = document.getElementById('loading');

      appendMessage(responseBox, `${currentUserId} >> ${message}`);
      userInput.value = '';
      loading.style.display = 'block';
      responseBox.scrollTop = responseBox.scrollHeight;

      try {
        const res = await fetch('/archssistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message, userId: currentUserId })
        });

        const data = await res.json();
        appendMessage(responseBox, `Archssistant >> ${data.reply || '(Sin respuesta)'}\n`);

      } catch (error) {
        appendMessage(responseBox, '⚠️ Error al contactar al servidor.\n');
        console.error(error);
      } finally {
        loading.style.display = 'none';
        responseBox.scrollTop = responseBox.scrollHeight;
      }
    }

    async function showHistory() {
        const historyDisplay = document.getElementById('historyDisplay');
        const historyTitle = document.getElementById('historyTitle');
        
        historyTitle.innerText = `Historial de: ${currentUserId}`;
        historyDisplay.innerHTML = 'Cargando historial...';

        try {
            const res = await fetch(`/archssistant/history/${currentUserId}`);
            const data = await res.json();

            const archivedConversations = data.filter(conv => !conv.isActive);

            if (archivedConversations.length === 0) {
                historyDisplay.innerHTML = 'No hay conversaciones archivadas.';
                return;
            }

            historyDisplay.innerHTML = '';
            archivedConversations.forEach(conv => {
                const history = typeof conv.history === 'string' ? JSON.parse(conv.history) : conv.history;
                const status = '(Archivada)';
                const header = document.createElement('div');
                header.innerHTML = `<strong>Conversación del ${new Date(conv.createdAt).toLocaleString()} ${status}</strong>`;
                header.style.cursor = 'pointer';
                header.style.backgroundColor = '#0000a0';
                header.style.padding = '5px';
                header.style.border = '1px solid white';
                header.style.marginBottom = '5px';
                
                const content = document.createElement('div');
                content.style.display = 'none';
                content.style.padding = '10px';
                content.style.border = '1px dashed #ccc';
                
                if (history && history.length > 0) {
                    history.forEach(item => {
                        if (item.role === 'user') {
                            content.innerHTML += `<strong>${currentUserId} >></strong> ${item.content}<br>`;
                        } else if (item.role === 'assistant') {
                            content.innerHTML += `<strong>Archssistant >></strong> ${item.content}<br>---<br>`;
                        }
                    });
                } else {
                    content.innerHTML = 'Esta conversación está vacía.';
                }

                header.onclick = () => {
                    content.style.display = content.style.display === 'none' ? 'block' : 'none';
                };

                historyDisplay.appendChild(header);
                historyDisplay.appendChild(content);
            });

        } catch (error) {
            historyDisplay.innerHTML = '⚠️ Error al cargar el historial.';
            console.error(error);
        }
    }

    function returnToMain() {
        currentUserId = null;
        document.getElementById('chatInterface').style.display = 'none';
        document.getElementById('userLogin').style.display = 'block';
        document.getElementById('initialUserName').value = '';
        document.getElementById('response').innerHTML = '(esperando respuesta...)';
    }

    function appendMessage(box, text) {
        if (box.innerHTML === '(esperando respuesta...)' || box.innerHTML.includes('Bienvenido')) {
            box.innerHTML = '';
        }
        box.innerHTML += text.replace(/\n/g, '<br>') + '<br>';
    }
