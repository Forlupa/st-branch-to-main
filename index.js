// Объявляем глобальные переменные SillyTavern для линтера и корректной работы
/* global characters, this_chid, chat_metadata, toastr, Swal, jQuery */

const extensionName = 'branch-to-main';

/**
 * Получает список всех файлов чатов для текущего персонажа
 */
async function getCharacterChats() {
    try {
        // Проверяем, выбран ли персонаж
        if (typeof this_chid === 'undefined' || this_chid === null) return {};

        const charName = characters[this_chid].name;
        const response = await fetch('/api/chats/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ch_name: charName })
        });
        
        if (!response.ok) throw new Error('Ошибка API при получении чатов');
        return await response.json();
    } catch (error) {
        console.error(`[${extensionName}]`, error);
        return {};
    }
}

/**
 * Основная логика замены основного чата данными из ветки
 */
async function makeBranchMain(mainChatFileName, branchFileName) {
    try {
        const charName = characters[this_chid].name;

        // 1. Получаем содержимое выбранной ветки
        const getBranchRes = await fetch('/api/chats/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ch_name: charName,
                file_name: branchFileName
            })
        });
        
        const branchData = await getBranchRes.json();
        
        if (!branchData || !Array.isArray(branchData)) {
            toastr.error('Не удалось загрузить данные ветки.');
            return;
        }

        // 2. Сохраняем эти данные в основной файл чата
        const saveRes = await fetch('/api/chats/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ch_name: charName,
                file_name: mainChatFileName,
                chat: branchData
            })
        });

        if (saveRes.ok) {
            toastr.success('Ветка установлена как основная!');
            // Используем встроенный метод SillyTavern для перезагрузки чата
            // @ts-ignore
            window.location.reload(); 
        } else {
            toastr.error('Ошибка при сохранении.');
        }
    } catch (error) {
        console.error(`[${extensionName}]`, error);
    }
}

async function openBranchSelector() {
    const chatsData = await getCharacterChats();
    const chatFiles = Object.keys(chatsData);
    const currentChat = chat_metadata.file_name; 

    const availableBranches = chatFiles.filter(file => file !== currentChat);

    if (availableBranches.length === 0) {
        toastr.info('Других веток не найдено.');
        return;
    }

    let optionsHtml = '';
    availableBranches.forEach(branch => {
        const displayName = branch.replace('.jsonl', '');
        optionsHtml += `<option value="${branch}">${displayName}</option>`;
    });

    const { isConfirmed, value: selectedBranch } = await Swal.fire({
        title: 'Выбрать основную ветку',
        html: `
            <div style="text-align:left;">
                <p>Текущий основной чат будет заменен выбранным ниже.</p>
                <select id="branch-select" class="swal2-select" style="display:flex; width:100%;">
                    ${optionsHtml}
                </select>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Заменить основной чат',
        preConfirm: () => document.getElementById('branch-select').value
    });

    if (isConfirmed && selectedBranch) {
        await makeBranchMain(currentChat, selectedBranch);
    }
}

async function initExtension() {
    // Добавляем кнопку в панель инструментов (Action Buttons)
    const buttonHtml = `
        <div id="btn_make_branch_main" class="menu_button fa-solid fa-code-branch" 
             title="Сделать ветку основной" 
             style="cursor: pointer;">
        </div>
    `;

    // Ждем появления панели и добавляем кнопку
    const interval = setInterval(() => {
        const container = document.getElementById('chat_actions');
        if (container) {
            clearInterval(interval);
            if (!document.getElementById('btn_make_branch_main')) {
                $(container).append(buttonHtml);
                $(document).on('click', '#btn_make_branch_main', openBranchSelector);
            }
        }
    }, 1000);
}

jQuery(initExtension);