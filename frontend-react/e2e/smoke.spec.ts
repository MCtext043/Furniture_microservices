import { expect,test } from '@playwright/test';
const browserErrors=new WeakMap<object,string[]>();
test.beforeEach(async({page})=>{const errors:string[]=[];browserErrors.set(page,errors);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`)})});
test.afterEach(async({page})=>expect(browserErrors.get(page)??[]).toEqual([]));

test('home exposes primary planning journey',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{name:/Дом начинается/})).toBeVisible();
 await expect(page.getByRole('link',{name:/Открыть планировщик/})).toBeVisible();
});

test('catalog route renders search',async({page})=>{
 await page.goto('/catalog');
 await expect(page.getByPlaceholder('Поиск по каталогу')).toBeVisible();
});

test('registered user can use commerce and planner',async({page})=>{
 const username=`e2e_${Date.now()}`;
 await page.goto('/register');
 await page.getByLabel('Логин').fill(username);
 await page.getByLabel('Пароль').fill('test123456');
 await page.getByRole('button',{name:'Зарегистрироваться'}).click();
 await expect(page).toHaveURL(/\/account/);
 await page.goto('/catalog');
 const card=page.locator('article').first();
 await card.getByRole('button',{name:'Добавить в избранное'}).click();
 await card.getByRole('button',{name:'Добавить в корзину'}).click();
 await expect(page.getByRole('link',{name:/Корзина: 1/})).toBeVisible();
 await page.goto('/cart');
 await expect(page.getByText('Итого')).toBeVisible();
 await page.reload();
 await expect(page.getByText('Итого')).toBeVisible();
 await page.goto('/planner');
 await expect(page.locator('canvas')).toBeVisible({timeout:20000});
 await page.getByRole('button',{name:'Шкаф'}).click();
 await expect(page.getByLabel('Название объекта')).toHaveValue('Шкаф');
 await page.getByLabel('Название проекта').fill('E2E React project');
 await page.getByRole('button',{name:'Сохранить'}).click();
 await expect(page.getByRole('status')).toContainText(/сохранен/i);
 await expect(page).toHaveURL(/project=\d+/);
 await page.reload();
 await expect(page.getByLabel('Название объекта')).toHaveValue('Шкаф');
 await expect(page.getByLabel('Название проекта')).toHaveValue('E2E React project');
 await page.getByRole('button',{name:'Отправить заявку'}).click();
 await expect(page.getByRole('status')).toContainText(/Заявка №\d+ создана/);
 await page.goto('/orders');
 await expect(page.getByText('E2E React project')).toBeVisible();
});

test('admin can create, find, edit and hide a product',async({page})=>{
 const suffix=`${Date.now()}_${Math.random().toString(36).slice(2,7)}`;const name=`E2E product ${suffix}`;
 await page.goto('/login');
 await page.getByLabel('Логин').fill('admin');
 await page.getByLabel('Пароль').fill('demo123456');
 await page.getByRole('button',{name:'Войти'}).click();
 await expect(page).toHaveURL(/\/account/);
 await page.goto('/admin');
 await page.getByRole('button',{name:'Новый товар'}).click();
 await page.getByLabel('Название').fill(name);
 await page.getByLabel('SKU').fill(`E2E-${suffix}`);
 await page.getByLabel('Бренд').fill('E2E');
 await page.getByLabel('Цена').fill('12500');
 await page.getByLabel('Остаток').fill('3');
 await page.getByLabel('Описание').fill('Проверка административного API');
 await page.getByRole('button',{name:'Сохранить на backend'}).click();
 await page.getByPlaceholder('Поиск в административном каталоге').fill(name);
 const row=page.getByRole('row').filter({hasText:name});
 await expect(row).toBeVisible();
 await row.getByRole('button',{name:'Изменить'}).click();
 await page.getByLabel('Цена').fill('13500');
 await page.getByRole('button',{name:'Сохранить на backend'}).click();
 await expect(row).toContainText('13 500');
 await row.getByRole('button',{name:'Скрыть товар'}).click();
 await expect(row).toHaveCount(0);
});
