export async function renderAbout(container) {
  container.innerHTML = `
    <div class="text-center mb-4">
      <h1 class="fw-bold">О сайте</h1>
      <p class="text-muted">Открытый портал данных города Тольятти</p>
    </div>

    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title fw-bold">О проекте</h5>
        <p class="card-text">«Открытый Тольятти» — независимый портал, предоставляющий открытые данные города Тольятти.</p>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-sm-6 col-lg-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-primary bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2"><i data-lucide="bus" style="width:28px;height:28px;" class="text-primary"></i></div>
            <h6 class="fw-bold">Транспорт</h6>
            <p class="small text-muted mb-0">Автобусные, троллейбусные и коммерческие маршруты</p>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-danger bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2"><i data-lucide="landmark" style="width:28px;height:28px;" class="text-danger"></i></div>
            <h6 class="fw-bold">Культура</h6>
            <p class="small text-muted mb-0">Библиотеки, музеи, театры и объекты наследия</p>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-success bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2"><i data-lucide="graduation-cap" style="width:28px;height:28px;" class="text-success"></i></div>
            <h6 class="fw-bold">Образование</h6>
            <p class="small text-muted mb-0">Школы, дошкольные и дополнительные учреждения</p>
          </div>
        </div>
      </div>
      <div class="col-sm-6 col-lg-3">
        <div class="card border-0 shadow-sm text-center h-100">
          <div class="card-body">
            <div class="bg-warning bg-opacity-10 rounded-circle d-inline-flex p-3 mb-2"><i data-lucide="dumbbell" style="width:28px;height:28px;" class="text-warning"></i></div>
            <h6 class="fw-bold">Спорт</h6>
            <p class="small text-muted mb-0">Бассейны, спортивные школы, физкультурные организации</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title fw-bold">Источники данных</h5>
        <p class="card-text">Все данные получены из открытых источников Администрации городского округа Тольятти:</p>
        <ul class="list-group list-group-flush">
          <li class="list-group-item"><strong>Реестр муниципальных маршрутов</strong> — официальная информация о городском транспорте</li>
          <li class="list-group-item"><strong>Портал открытых данных</strong> — централизованное хранилище городской информации</li>
        </ul>
      </div>
    </div>

    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title fw-bold">Лицензия и технологии</h5>
        <p class="card-text">Данные распространяются по лицензии <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank">CC BY 4.0</a>.</p>
        <div class="d-flex flex-wrap gap-2 mt-3">
          <span class="badge bg-primary"><img height="14" width="14" src="https://cdn.simpleicons.org/bootstrap/white"/> Bootstrap</span>
          <span class="badge bg-primary"><img height="14" width="14" src="https://cdn.simpleicons.org/lucide/white"/> Lucide</span>
          <span class="badge bg-primary"><img height="14" width="14" src="https://cdn.simpleicons.org/nodedotjs/white"/> Node.js</span>
        </div>
      </div>
    </div>

    <div class="card border-0 shadow-sm mb-4">
      <div class="card-body">
        <h5 class="card-title fw-bold">Репозиторий</h5>
        <a href="https://github.com/zhidkovers/opentgl" class="link-dark link-underline link-underline-opacity-0"><img height="16" width="16" src="https://cdn.simpleicons.org/github/black"/>  https://github.com/zhidkovers/opentgl</a>
      </div>
    </div>`;
}