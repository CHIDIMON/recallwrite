let currentNoteId = null;
let allNotes = [];
let customFolders = JSON.parse(localStorage.getItem('customFolders') || '[]');
let currentView = 'active'; // 'active' หรือ 'trash'

const SizeStyle = Quill.import('attributors/style/size');
SizeStyle.whitelist = ['12px', '14px', '16px', '20px', '24px', '32px', '48px', '64px'];
Quill.register(SizeStyle, true);
Quill.register('modules/blotFormatter', QuillBlotFormatter.default);

var quill = new Quill('#editor-container', {
    theme: 'bubble',
    placeholder: 'Title goes here...\n\nAnd start writing your story...',
    modules: {
        blotFormatter: {},
        keyboard: {
            bindings: {
                enterFirstLine: {
                    key: 13, // ดักจับการกดปุ่ม Enter
                    handler: function(range, context) {
                        // เช็คว่าเคอร์เซอร์อยู่บรรทัดแรกหรือไม่ (ไม่มีการขึ้นบรรทัดใหม่ \n อยู่ก่อนหน้า)
                        const isFirstLine = this.quill.getText().substring(0, range.index).indexOf('\n') === -1;
                        
                        setTimeout(() => {
                            if (isFirstLine) {
                                // ยกเลิกขนาดตัวอักษรที่ติดมา ให้กลับไปเป็นขนาดปกติ (18px)
                                this.quill.format('size', false, 'user');
                            }
                        }, 10);
                        
                        return true; // ยอมให้ระบบขึ้นบรรทัดใหม่ตามปกติ
                    }
                }
            }
        },
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'size': ['12px', '14px', '16px', false, '20px', '24px', '32px', '48px', '64px'] }],
            ['blockquote', 'code-block'],
            ['link'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
        ]
    }
});

/* ตั้งค่าให้บรรทัดแรกสุดตอนโหลดเว็บเป็นขนาด 48px เสมอ */
quill.formatText(0, 1, 'size', '48px');

/* ตรวจจับเพื่อให้บรรทัดแรกที่ว่างเปล่า พร้อมพิมพ์ขนาด 48px เสมอเวลาเคอร์เซอร์ไปวาง */
quill.on('selection-change', function(range) {
    // หากคลิกเข้ามาตอนหน้ากระดาษยังว่างเปล่า (length <= 1 คือมีแค่ Enter ตัวเดียว)
    if (range && quill.getLength() <= 1) {
        quill.format('size', '48px');
    }
});

/* ตรวจจับเวลาผู้ใช้ลบข้อความทิ้งจนหมดกระดาษ ให้เซ็ตกลับเป็นขนาด 48px ไว้รอเลย */
quill.on('text-change', function() {
    if (quill.getLength() <= 1) {
        quill.formatText(0, 1, 'size', '48px', 'silent');
        
        // หน่วงเวลาให้ Quill ลบข้อมูลเสร็จก่อน แล้วบังคับเคอร์เซอร์ที่กำลังพิมพ์ให้เป็น 48px
        setTimeout(() => {
            if (quill.hasFocus()) {
                quill.format('size', '48px');
            }
        }, 10);
    }
});

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
        if (window.innerWidth < 768) {
            backdrop.classList.toggle('show', !sidebar.classList.contains('collapsed'));
        } else {
            backdrop.classList.remove('show');
        }
    }
}

async function fetchNotes() {
    try {
        const response = await fetch('/api/notes/');
        if (!response.ok) {
            console.error("Backend Error:", await response.text());
            return;
        }
        allNotes = await response.json();
        
        // ให้โน้ตที่ไม่มี is_trash มีค่า default เป็น false
        allNotes = allNotes.map(n => ({...n, is_trash: n.is_trash || false}));
        refreshListUI();
    } catch (e) {
        console.error("Fetch notes error:", e);
    }
}

function refreshListUI() {
    const query = document.getElementById('search-box').value.toLowerCase();
    const filteredNotes = allNotes.filter(note => {
        const matchesView = currentView === 'trash' ? note.is_trash : !note.is_trash;
        const matchTitle = note.title && note.title.toLowerCase().includes(query);
        const matchFolder = note.folder && note.folder.toLowerCase().includes(query);
        return matchesView && (matchTitle || matchFolder);
    });
    renderNoteList(filteredNotes);
}

function renderNoteList(notes) {
    const listContainer = document.getElementById('note-list');
    listContainer.innerHTML = '';

    const tree = { name: '', fullPath: '', children: {}, notes: [] };

    // 1. นำโน้ตมาสร้างเป็นโครงสร้างต้นไม้ (Tree)
    notes.forEach(note => {
        let path = note.folder || '';
        let current = tree;
        if (path) {
            let parts = path.split('/').map(p => p.trim()).filter(p => p);
            let currentPath = '';
            for (let part of parts) {
                currentPath = currentPath ? currentPath + '/' + part : part;
                if (!current.children[part]) {
                    current.children[part] = { name: part, fullPath: currentPath, children: {}, notes: [] };
                }
                current = current.children[part];
            }
        }
        current.notes.push(note);
    });

    // 2. นำโฟลเดอร์ว่างมาสร้างเป็นโครงสร้างต้นไม้
    customFolders.forEach(path => {
        let parts = path.split('/').map(p => p.trim()).filter(p => p);
        let current = tree;
        let currentPath = '';
        for (let part of parts) {
            currentPath = currentPath ? currentPath + '/' + part : part;
            if (!current.children[part]) {
                current.children[part] = { name: part, fullPath: currentPath, children: {}, notes: [] };
            }
            current = current.children[part];
        }
    });

    // 3. รวบรวม Path ทั้งหมดไปใส่เป็นตัวช่วยเติมคำ (Datalist)
    const allPaths = [];
    function collectPaths(node) {
        if (node.fullPath) allPaths.push(node.fullPath);
        Object.values(node.children).forEach(collectPaths);
    }
    collectPaths(tree);

    const datalist = document.getElementById('folder-options');
    if (datalist) {
        datalist.innerHTML = allPaths.map(f => `<option value="${f}">`).join('');
    }

    const sortMode = document.getElementById('sort-options').value;

    // 4. ฟังก์ชันแบบเรียกตัวเอง (Recursive) สำหรับวาดหน้าจอ
    function createFolderNode(node, isRoot = false) {
        node.notes.sort((a, b) => {
            if (b.is_pinned !== a.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
            let dateA, dateB;
            if (sortMode === 'updated_desc') { dateA = new Date(a.updated_at || a.created_at || 0); dateB = new Date(b.updated_at || b.created_at || 0); return dateB - dateA; }
            else if (sortMode === 'created_desc') { dateA = new Date(a.created_at || 0); dateB = new Date(b.created_at || 0); return dateB - dateA; }
            else if (sortMode === 'created_asc') { dateA = new Date(a.created_at || 0); dateB = new Date(b.created_at || 0); return dateA - dateB; }
            return 0;
        });
        
        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-group';
        
        folderDiv.ondragenter = (e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            // ป้องกันการเอาโฟลเดอร์ลากไปใส่ตัวเอง หรือโฟลเดอร์ลูกของตัวเอง
            if (window.draggedFolder && (node.fullPath === window.draggedFolder || node.fullPath.startsWith(window.draggedFolder + '/'))) return;
            folderDiv.classList.add('drag-over'); 
        };
        folderDiv.ondragover = (e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            if (window.draggedFolder && (node.fullPath === window.draggedFolder || node.fullPath.startsWith(window.draggedFolder + '/'))) {
                e.dataTransfer.dropEffect = 'none';
                return;
            }
            e.dataTransfer.dropEffect = 'move'; 
        };
        folderDiv.ondragleave = (e) => { e.stopPropagation(); if (!e.relatedTarget || !folderDiv.contains(e.relatedTarget)) folderDiv.classList.remove('drag-over'); };
        folderDiv.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation(); // กัน event รั่วไหล
            e.currentTarget.classList.remove('drag-over');
            document.body.classList.remove('is-dragging'); // ปิดสถานะการลาก
            
            const draggedNoteId = e.dataTransfer.getData('text/plain') || window.draggedNoteId;
            const draggedFolderPath = e.dataTransfer.getData('text/folder') || window.draggedFolder;

            if (draggedNoteId) {
                moveNoteToFolder(draggedNoteId, node.fullPath);
            } else if (draggedFolderPath) {
                moveFolder(draggedFolderPath, node.fullPath);
            }
            
            window.draggedNoteId = null;
            window.draggedFolder = null;
        };

        if (isRoot) {
            folderDiv.innerHTML = `<div class="folder-header"><span>📄 General Notes</span><div class="folder-header-actions"><span class="toggle-icon">▼</span></div></div>`;
        } else {
            folderDiv.innerHTML = `<div class="folder-header"><span>📁 ${node.name}</span><div class="folder-header-actions"><span class="delete-folder-btn" title="Delete folder">🗑️</span><span class="toggle-icon">▼</span></div></div>`;
        }

        const header = folderDiv.querySelector('.folder-header');
        header.onclick = () => {
            folderDiv.classList.toggle('collapsed');
        };

        if (!isRoot) {
            header.draggable = true;
            header.ondragstart = (e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/folder', node.fullPath);
                window.draggedFolder = node.fullPath;
                
                setTimeout(() => {
                    header.classList.add('is-dragged');
                    folderDiv.classList.add('is-dragged'); 
                    document.body.classList.add('is-dragging'); 
                }, 0);
            };
            header.ondragend = (e) => {
                header.classList.remove('is-dragged');
                folderDiv.classList.remove('is-dragged');
                document.body.classList.remove('is-dragging');
                window.draggedFolder = null;
                document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            };

            const deleteBtn = folderDiv.querySelector('.delete-folder-btn');
            if (deleteBtn) {
                deleteBtn.onclick = (e) => { e.stopPropagation(); deleteFolder(node.fullPath); };
            }
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'folder-content';
        folderDiv.appendChild(contentDiv);
        
        if (!isRoot) {
            Object.keys(node.children).sort((a,b) => a.localeCompare(b)).forEach(childName => {
                contentDiv.appendChild(createFolderNode(node.children[childName]));
            });
        }

        node.notes.forEach(note => {
            const li = document.createElement('li');
            li.className = 'note-item' + (note.id === currentNoteId ? ' active' : '');
            li.onclick = () => loadNote(note);
            
            const pinIcon = note.is_pinned ? '📌 ' : '';
            li.innerHTML = `<div class="note-title-list" style="pointer-events: none;">${pinIcon}${note.title || 'Untitled Note'}</div>`;
            
            // --- ทำให้โน้ตสามารถลากได้ (Draggable) ---
            li.draggable = true;
            li.ondragstart = (e) => {
                e.stopPropagation(); // ป้องกันการกวนกันของ Event
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', note.id.toString());
                window.draggedNoteId = note.id.toString(); // เก็บค่าสำรองไว้ (กันเบราว์เซอร์ลืม)
                
                // ทริกสำคัญ: ใช้ setTimeout เพื่อหน่วงเวลา 0ms ไม่ให้ Browser ตกใจจนยกเลิกการวาง (Drop)
                setTimeout(() => {
                    e.target.classList.add('is-dragged'); 
                    document.body.classList.add('is-dragging'); 
                }, 0);
            };
            li.ondragend = (e) => {
                e.target.classList.remove('is-dragged'); // ล้างสถานะเมื่อลากเสร็จ
                document.body.classList.remove('is-dragging'); // คืนค่าปกติเมื่อปล่อยเมาส์
                window.draggedNoteId = null;
                document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over')); // ล้างไฮไลต์เผื่อค้าง
            };

            contentDiv.appendChild(li);
        });

        if (node.notes.length === 0 && Object.keys(node.children).length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-folder-msg';
            emptyMsg.innerText = 'Drop notes here';
            contentDiv.appendChild(emptyMsg);
        }

        return folderDiv;
    }

    // 5. นำโครงสร้างที่วาดเสร็จมาแสดงผลลงหน้าจอ
    Object.keys(tree.children).sort((a,b) => a.localeCompare(b)).forEach(childName => {
        listContainer.appendChild(createFolderNode(tree.children[childName]));
    });
    
    listContainer.appendChild(createFolderNode(tree, true)); // โน้ตทั่วไปเอาไว้ล่างสุด
}

function searchNotes() {
    refreshListUI();
}

function formatTime(dateString) {
    if (!dateString) return '';
    
    // ตรวจสอบและบังคับให้เป็นเวลา UTC ถ้าเซิร์ฟเวอร์ไม่ได้แนบ Timezone มาให้
    let safeDateString = dateString;
    if (!safeDateString.includes('Z') && !safeDateString.includes('+')) {
        safeDateString += 'Z';
    }
    
    const date = new Date(safeDateString);
    return date.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', year: 'numeric', 
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Bangkok',
        hour12: false
    });
}

function updateTimestampsUI(note) {
    const container = document.getElementById('note-timestamps');
    if (!note || !note.created_at) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';
    let text = `Created: ${formatTime(note.created_at)}`;
    if (note.updated_at && note.updated_at !== note.created_at) {
        text += ` | Last edited: ${formatTime(note.updated_at)}`;
    }
    container.innerText = text;
}

function switchTab(tab) {
    if (currentNoteId && currentView === 'active') {
        silentAutoSave(currentNoteId, quill.getText().trim(), quill.root.innerHTML, document.getElementById('note-folder').value);
    }
    currentView = tab;
    document.getElementById('tab-active').classList.toggle('active', tab === 'active');
    document.getElementById('tab-trash').classList.toggle('active', tab === 'trash');
    
    document.getElementById('new-note-btn').style.display = tab === 'active' ? 'block' : 'none';
    document.getElementById('new-folder-btn').style.display = tab === 'active' ? 'block' : 'none';
    
    currentNoteId = null;
    quill.setText('');
    quill.enable(tab === 'active');
    document.getElementById('delete-btn').style.display = 'none';
    document.getElementById('save-btn').style.display = 'none';
    document.getElementById('img-btn').style.display = 'none';
    document.getElementById('restore-btn').style.display = 'none';
    document.getElementById('pin-btn').style.display = 'none';
    updateTimestampsUI(null);
    
    refreshListUI();
}

async function togglePinNote() {
    if (currentNoteId === null) return;
    
    const note = allNotes.find(n => n.id === currentNoteId);
    if (!note) return;
    
    note.is_pinned = !note.is_pinned;
    
    const pinBtn = document.getElementById('pin-btn');
    if (note.is_pinned) pinBtn.classList.add('pinned');
    else pinBtn.classList.remove('pinned');
    
    refreshListUI();
    
    try {
        await fetch(`/api/notes/${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: note.title, content: note.content, folder: note.folder || '', 
                is_pinned: note.is_pinned, is_trash: note.is_trash || false 
            })
        });
    } catch (e) {
        console.error("Error pinning note", e);
    }
}

function deleteFolder(folderName) {
    showCustomConfirm(
        "Delete Folder",
        `Are you sure you want to delete the folder "${folderName}" and its sub-folders?\n(All notes inside will be moved to "General Notes")`,
        "Delete",
        async () => {
            // 1. ลบชื่อโฟลเดอร์ออกจากประวัติที่เก็บไว้ในเครื่อง
            customFolders = customFolders.filter(f => f !== folderName && !f.startsWith(folderName + '/'));
            localStorage.setItem('customFolders', JSON.stringify(customFolders));

            // 2. ดึงโน้ตที่อยู่ในโฟลเดอร์นี้มาเปลี่ยนให้เป็นค่าว่าง (โน้ตทั่วไป) บนหน้าจอทันที
            const notesToMove = allNotes.filter(n => n.folder === folderName || (n.folder && n.folder.startsWith(folderName + '/')));
            notesToMove.forEach(n => n.folder = '');
            
            if (currentNoteId) {
                const currentNote = allNotes.find(n => n.id === currentNoteId);
                if (currentNote && document.getElementById('note-folder')) {
                    document.getElementById('note-folder').value = currentNote.folder || '';
                }
            }
            refreshListUI();

            // 3. ทยอยส่งข้อมูลอัปเดตโน้ตไปบอกหลังบ้านแบบ Background
            try {
                await Promise.all(notesToMove.map(note => 
                    fetch(`/api/notes/${note.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: note.title, content: note.content, folder: '', 
                                               is_pinned: note.is_pinned || false, is_trash: note.is_trash || false })
                    })
                ));
            } catch (e) {
                console.error("Error deleting folder", e);
            }
        }
    );
}

function silentAutoSave(idToSave, titleToSave, contentToSave, folderToSave) {
    if (currentView === 'trash') return; // ไม่เซฟโน้ตที่อยู่ในถังขยะ
    // ไม่ต้องเซฟถ้าเป็นโน้ตใหม่ที่ยังไม่ได้พิมพ์อะไรเลย (เพื่อป้องกันโน้ตขยะ)
    if (idToSave === null && !titleToSave && !contentToSave.includes('<img')) return;

    const extractedTitle = titleToSave 
        ? titleToSave.split('\n')[0].substring(0, 50) 
        : 'Untitled Note';

    let url = '/api/notes/';
    let method = 'POST';
    let isPinned = false;
    let isTrash = false;

    if (idToSave !== null) {
        url = `/api/notes/${idToSave}`;
        method = 'PUT';
        const existingNote = allNotes.find(n => n.id === idToSave);
        if (existingNote) {
            isPinned = existingNote.is_pinned || false;
            isTrash = existingNote.is_trash || false;
        }
    }

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: extractedTitle, content: contentToSave, folder: folderToSave || '', 
                               is_pinned: isPinned, is_trash: isTrash }),
        keepalive: true // บังคับให้เบราว์เซอร์ส่งข้อมูลให้เสร็จ แม้ผู้ใช้จะกดปิดแท็บเว็บไปแล้ว
    }).then(response => {
        if (response.ok) {
            if (method === 'POST') {
                fetchNotes(); // โหลดใหม่เฉพาะตอนสร้างโน้ตใหม่ (เพื่อให้ได้ ID จากเซิร์ฟเวอร์)
            } else {
                // อัปเดตข้อมูล Local State เพื่อไม่ให้ UI กระตุกหรือเด้งกลับเวลาคลิกโน้ตอื่น
                const idx = allNotes.findIndex(n => n.id === idToSave);
                if (idx !== -1) {
                    allNotes[idx].title = extractedTitle;
                    allNotes[idx].content = contentToSave;
                    allNotes[idx].folder = folderToSave || '';
                }
            }
        }
    }).catch(e => console.error("Auto save error", e));
}

function loadNote(note) {
    // เซฟโน้ตปัจจุบันอัตโนมัติก่อนเปิดโน้ตอื่น
    if (currentNoteId !== note.id && currentView === 'active' && !note.is_trash) {
        silentAutoSave(currentNoteId, quill.getText().trim(), quill.root.innerHTML, document.getElementById('note-folder').value);
    }

    currentNoteId = note.id;
    quill.root.innerHTML = note.content;
    document.getElementById('note-folder').value = note.folder || '';
    
    if (note.is_trash) {
        quill.enable(false);
        document.getElementById('delete-btn').innerText = 'Delete Forever';
        document.getElementById('delete-btn').style.display = 'block';
        document.getElementById('restore-btn').style.display = 'block';
        document.getElementById('save-btn').style.display = 'none';
        document.getElementById('img-btn').style.display = 'none';
        document.getElementById('pin-btn').style.display = 'none';
    } else {
        quill.enable(true);
        document.getElementById('delete-btn').innerText = 'Delete';
        document.getElementById('delete-btn').style.display = 'block';
        document.getElementById('restore-btn').style.display = 'none';
        document.getElementById('save-btn').style.display = 'block';
        document.getElementById('img-btn').style.display = 'flex';
        
        const pinBtn = document.getElementById('pin-btn');
        if (pinBtn) {
            pinBtn.style.display = 'block';
            if (note.is_pinned) pinBtn.classList.add('pinned');
            else pinBtn.classList.remove('pinned');
        }
    }
    
    updateTimestampsUI(note);
    
    if(window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('collapsed');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
    }
    refreshListUI(); 
}

function createNewNote() {
    if (currentView === 'trash') {
        switchTab('active');
    }

    // เซฟโน้ตปัจจุบันอัตโนมัติก่อนสร้างโน้ตใหม่
    if (currentNoteId) {
        silentAutoSave(currentNoteId, quill.getText().trim(), quill.root.innerHTML, document.getElementById('note-folder').value);
    }

    currentNoteId = null;
    quill.setText(''); /* ล้างข้อความให้ว่างเปล่าอย่างปลอดภัย */
    quill.focus(); /* ดึงเคอร์เซอร์มาวางรอกะพริบในหน้ากระดาษทันที */
    quill.format('size', '48px'); /* บังคับขนาดของเคอร์เซอร์ที่รอพิมพ์ให้เป็น 48px เสมอ */
    updateTimestampsUI(null);
    
    document.getElementById('note-folder').value = '';
    document.getElementById('delete-btn').style.display = 'none';
    
    const pinBtn = document.getElementById('pin-btn');
    if (pinBtn) {
        pinBtn.style.display = 'none';
        pinBtn.classList.remove('pinned');
    }
    
    document.getElementById('save-btn').style.display = 'block';
    document.getElementById('img-btn').style.display = 'flex';
    document.getElementById('restore-btn').style.display = 'none';
    
    if(window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('collapsed');
        const backdrop = document.getElementById('sidebar-backdrop');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
    }

    refreshListUI();
}

function createNewFolder() {
    showCustomPrompt("Create New Folder", "e.g., Work/ProjectA", (folderName) => {
        if (folderName && folderName.trim() !== '') {
            const name = folderName.trim();
            if (!customFolders.includes(name)) {
                customFolders.push(name);
                localStorage.setItem('customFolders', JSON.stringify(customFolders));
                refreshListUI(); 
            }
        }
    });
}

function showCustomPrompt(title, placeholder, callback) {
    const modal = document.getElementById('custom-prompt-modal');
    const input = document.getElementById('custom-prompt-input');
    const confirmBtn = document.getElementById('custom-prompt-confirm');
    const cancelBtn = document.getElementById('custom-prompt-cancel');

    document.getElementById('custom-prompt-title').innerText = title;
    input.placeholder = placeholder;
    input.value = '';
    
    modal.classList.add('show');
    setTimeout(() => input.focus(), 50); // ดีเลย์เล็กน้อยเพื่อให้ Focus ทำงานได้สมบูรณ์

    const cleanup = () => {
        modal.classList.remove('show');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
        input.onkeydown = null;
    };

    confirmBtn.onclick = () => { callback(input.value); cleanup(); };
    cancelBtn.onclick = () => cleanup();

    input.onkeydown = (e) => {
        if (e.key === 'Enter') { callback(input.value); cleanup(); }
        else if (e.key === 'Escape') { cleanup(); }
    };
}

async function moveNoteToFolder(noteIdStr, newFolder) {
    // ใช้การเทียบ String แทน เผื่อกรณี Backend ใช้ ID เป็นตัวหนังสือ (เช่น UUID)
    const note = allNotes.find(n => n.id.toString() === noteIdStr);
    if (!note) return;

    // ป้องกันบั๊กกรณี undefined เทียบกับค่าว่าง
    const targetFolder = newFolder || '';
    const currentFolder = note.folder || '';
    
    if (currentFolder === targetFolder) return; // ถ้าลากไปวางโฟลเดอร์เดิมไม่ต้องทำอะไร

    note.folder = targetFolder;
    refreshListUI(); // เรนเดอร์ใหม่ทันทีเพื่อให้ UI เปลี่ยนไว

    if (note.id === currentNoteId) {
        const fInput = document.getElementById('note-folder');
        if (fInput) fInput.value = targetFolder;
    }

    try {
        await fetch(`/api/notes/${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: note.title, content: note.content, folder: targetFolder, 
                                   is_pinned: note.is_pinned || false, is_trash: note.is_trash || false })
        });
        // ลบคำสั่ง fetchNotes() ออกชั่วคราว เพื่อป้องกัน UI เด้งกลับ (Snapback) 
    } catch (e) {
        console.error("Move folder error", e);
    }
}

async function moveFolder(oldPath, targetPath) {
    if (!oldPath) return; // ป้องกันการลากหมวดโน้ตทั่วไป
    // ป้องกันการลากใส่ตัวเอง หรือโฟลเดอร์ย่อยของตัวเอง
    if (targetPath === oldPath || targetPath.startsWith(oldPath + '/')) return;

    const folderName = oldPath.split('/').pop();
    const newPath = targetPath ? `${targetPath}/${folderName}` : folderName;

    if (oldPath === newPath) return;

    // 1. อัปเดตโฟลเดอร์เปล่าที่เซฟไว้ในเครื่อง
    customFolders = customFolders.map(f => {
        if (f === oldPath) return newPath;
        if (f.startsWith(oldPath + '/')) return f.replace(oldPath + '/', newPath + '/');
        return f;
    });
    localStorage.setItem('customFolders', JSON.stringify(customFolders));

    // 2. อัปเดต Path ของโน้ตทั้งหมดที่ได้รับผลกระทบ
    const notesToMove = allNotes.filter(n => n.folder === oldPath || (n.folder && n.folder.startsWith(oldPath + '/')));
    notesToMove.forEach(n => {
        if (n.folder === oldPath) n.folder = newPath;
        else n.folder = n.folder.replace(oldPath + '/', newPath + '/');
    });

    refreshListUI();

    // 3. ทยอยส่งคำสั่งไปยัง Database เพื่อเปลี่ยนที่อยู่โน้ต
    try {
        await Promise.all(notesToMove.map(note => 
            fetch(`/api/notes/${note.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: note.title, content: note.content, folder: note.folder, 
                                       is_pinned: note.is_pinned || false, is_trash: note.is_trash || false })
            })
        ));
    } catch (e) {
        console.error("Error moving folder", e);
    }
}

async function saveNote() {
    const saveBtn = document.getElementById('save-btn');
    const originalText = saveBtn.innerText;
    saveBtn.innerText = "Saving...";

    const textContent = quill.getText().trim();
    const extractedTitle = textContent 
        ? textContent.split('\n')[0].substring(0, 50) 
        : 'Untitled Note';
        
    const contentHtml = quill.root.innerHTML;
    const folderName = document.getElementById('note-folder').value;

    let url = '/api/notes/';
    let method = 'POST';
    let isPinned = false;
    let isTrash = false;

    if (currentNoteId !== null) {
        url = `/api/notes/${currentNoteId}`;
        method = 'PUT';
        const existingNote = allNotes.find(n => n.id === currentNoteId);
        if (existingNote) {
            isPinned = existingNote.is_pinned || false;
            isTrash = existingNote.is_trash || false;
        }
    }

    const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: extractedTitle, content: contentHtml, folder: folderName, 
                               is_pinned: isPinned, is_trash: isTrash })
    });

    if(response.ok) {
        const savedNote = await response.json();
        currentNoteId = savedNote.id; 
        
        setTimeout(() => {
            saveBtn.innerText = "Saved successfully!";
            document.getElementById('delete-btn').style.display = 'block';
            // อัปเดต UI โดยไม่ต้องโหลดข้อมูลกลับไปกลับมา
            const idx = allNotes.findIndex(n => n.id === savedNote.id);
            if (idx !== -1) {
                allNotes[idx] = savedNote;
            } else {
                allNotes.unshift(savedNote);
            }
            updateTimestampsUI(savedNote);
            refreshListUI();
            setTimeout(() => saveBtn.innerText = originalText, 2000);
        }, 300);
    } else {
        saveBtn.innerText = "Save failed!";
        console.error("Save error:", await response.text());
        setTimeout(() => saveBtn.innerText = originalText, 2000);
    }
}

function deleteNote() {
    if (currentNoteId === null) return;
    
    if (currentView === 'active') {
        showCustomConfirm(
            "Move to Trash",
            "Are you sure you want to move this note to the trash?",
            "Move to Trash",
            async () => {
                const note = allNotes.find(n => n.id === currentNoteId);
                note.is_trash = true;
                const response = await fetch(`/api/notes/${currentNoteId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        title: note.title, content: note.content, folder: note.folder || '', 
                        is_pinned: note.is_pinned || false, is_trash: true 
                    })
                });
                if (response.ok) {
                    currentNoteId = null;
                    quill.setText('');
                    document.getElementById('delete-btn').style.display = 'none';
                    document.getElementById('pin-btn').style.display = 'none';
                    document.getElementById('save-btn').style.display = 'none';
                    document.getElementById('img-btn').style.display = 'none';
                    refreshListUI();
                }
            }
        );
    } else {
        showCustomConfirm(
            "Delete Forever",
            "Are you sure you want to permanently delete this note? This action cannot be undone.",
            "Delete Forever",
            async () => {
                const response = await fetch(`/api/notes/${currentNoteId}`, { method: 'DELETE' });
                if (response.ok) {
                    currentNoteId = null; // ล้าง ID ทิ้งก่อน เพื่อป้องกันไม่ให้ระบบเผลอ Auto-save โน้ตที่เพิ่งลบไป
                    quill.setText('');
                    document.getElementById('delete-btn').style.display = 'none';
                    document.getElementById('restore-btn').style.display = 'none';
                    fetchNotes();
                }
            }
        );
    }
}

async function restoreNote() {
    if (currentNoteId === null) return;
    
    const note = allNotes.find(n => n.id === currentNoteId);
    note.is_trash = false;
    
    const response = await fetch(`/api/notes/${currentNoteId}`, { 
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            title: note.title, content: note.content, folder: note.folder || '', 
            is_pinned: note.is_pinned || false, is_trash: false 
        })
    });

    if (response.ok) {
        currentNoteId = null;
        quill.setText('');
        document.getElementById('delete-btn').style.display = 'none';
        document.getElementById('restore-btn').style.display = 'none';
        refreshListUI();
    }
}

function showCustomConfirm(title, message, confirmText, callback) {
    const modal = document.getElementById('custom-confirm-modal');
    const confirmBtn = document.getElementById('custom-confirm-btn');
    const cancelBtn = document.getElementById('custom-confirm-cancel');

    document.getElementById('custom-confirm-title').innerText = title;
    document.getElementById('custom-confirm-message').innerText = message;
    confirmBtn.innerText = confirmText;
    
    modal.classList.add('show');

    const cleanup = () => {
        modal.classList.remove('show');
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };

    confirmBtn.onclick = () => { callback(); cleanup(); };
    cancelBtn.onclick = () => cleanup();
}

function selectLocalImage() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.click();
    input.onchange = () => { saveImageToServer(input.files[0]); };
}

async function saveImageToServer(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
    const result = await response.json();
    const range = quill.getSelection(true);
    
    // แทรกรูปภาพตรงตำแหน่ง Cursor
    let index = range ? range.index : quill.getLength();
    quill.insertEmbed(index, 'image', result.url);
}

quill.root.addEventListener('paste', (e) => {
    const clipboard = e.clipboardData;
    if (clipboard && clipboard.items) {
        for (let i = 0; i < clipboard.items.length; i++) {
            if (clipboard.items[i].type.indexOf('image') !== -1) {
                e.preventDefault(); /* ป้องกันระบบ Paste เดิมของ Quill วางรูปซ้ำ (Base64) */
                saveImageToServer(clipboard.items[i].getAsFile());
            }
        }
    }
});

// เซฟอัตโนมัติเมื่อผู้ใช้ปิดแท็บหรือรีเฟรชหน้าเว็บ (กันเหนียว)
window.addEventListener('beforeunload', () => {
    if (currentView === 'active') {
        silentAutoSave(currentNoteId, quill.getText().trim(), quill.root.innerHTML, document.getElementById('note-folder').value);
    }
});

fetchNotes();

// ปิด Sidebar อัตโนมัติเมื่อเปิดเว็บบนหน้าจอมือถือครั้งแรก
if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.add('collapsed');
}

// --- ระบบขยับรูปภาพอิสระตามแกน (Canva-style Absolute Dragging) ---
let isDraggingImg = false;
let dragImgTarget = null;
let startMouseX, startMouseY, startImgX, startImgY;

const editorNode = document.querySelector('.ql-editor');

editorNode.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'IMG') {
        dragImgTarget = e.target;
        isDraggingImg = true;
        
        // ถ้ายังไม่ได้เป็น Absolute ให้แปลงร่างทันที
        if (dragImgTarget.style.position !== 'absolute') {
            const rect = dragImgTarget.getBoundingClientRect();
            const editorRect = editorNode.getBoundingClientRect();
            
            dragImgTarget.style.position = 'absolute';
            
            // คำนวณจุดซ้ายบนของรูปเทียบกับหน้ากระดาษ เพื่อไม่ให้รูปกระโดดตอนเริ่มลาก
            dragImgTarget.style.left = (rect.left - editorRect.left + editorNode.scrollLeft) + 'px';
            dragImgTarget.style.top = (rect.top - editorRect.top + editorNode.scrollTop) + 'px';
            
            dragImgTarget.style.float = 'none';
            dragImgTarget.style.margin = '0';
        }

        startMouseX = e.clientX;
        startMouseY = e.clientY;
        startImgX = parseFloat(dragImgTarget.style.left) || 0;
        startImgY = parseFloat(dragImgTarget.style.top) || 0;
        
        // ซ่อนกรอบย่อ-ขยายชั่วคราวขณะลากเพื่อความลื่นไหล
        document.querySelectorAll('.blot-formatter__overlay').forEach(el => el.style.display = 'none');
        e.preventDefault(); // ป้องกัน Ghost drag ดั้งเดิมของเบราว์เซอร์
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDraggingImg && dragImgTarget) {
        const dx = e.clientX - startMouseX;
        const dy = e.clientY - startMouseY;
        dragImgTarget.style.left = (startImgX + dx) + 'px';
        dragImgTarget.style.top = (startImgY + dy) + 'px';
    }
});

document.addEventListener('mouseup', () => {
    if (isDraggingImg) {
        isDraggingImg = false;
        dragImgTarget = null;
        
        // เปิดกรอบย่อ-ขยายกลับมา
        document.querySelectorAll('.blot-formatter__overlay').forEach(el => el.style.display = 'block');
        
        // บังคับเซฟอัตโนมัติเมื่อวางรูปเสร็จ
        if (currentNoteId) {
            silentAutoSave(currentNoteId, quill.getText().trim(), quill.root.innerHTML, document.getElementById('note-folder').value);
        }
    }
});