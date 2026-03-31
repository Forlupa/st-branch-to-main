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
    console.log("[branch-to-main] Инициализация...");

    // Создаем элемент списка для меню расширений
    // Мы используем классы, которые SillyTavern применяет для пунктов этого меню
    const menuItemHtml = `
        <div id="btn_make_branch_main" class="list-group-item menu_button" title="Сделать ветку основной">
            <i class="fa-solid fa-code-branch"></i>
            <span data-i18n="Make Branch Main">Make Branch Main</span>
        </div>
    `;

    // Ждем появления меню расширений (оно находится рядом с вводом текста)
    const interval = setInterval(() => {
        const extensionsMenu = document.getElementById('extensions_menu');
        
        if (extensionsMenu) {
            clearInterval(interval);
            
            // Проверяем, не добавлена ли кнопка уже (чтобы не дублировать при обновлении)
            if (!document.getElementById('btn_make_branch_main')) {
                $(extensionsMenu).append(menuItemHtml);
                
                // Навешиваем событие клика
                $(document).on('click', '#btn_make_branch_main', async () => {
                    await openBranchSelector();
                });
            }
        }
    }, 1000);
}

jQuery(initExtension);