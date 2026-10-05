import './ui/styles/app.css';
import { appState } from './app/state';
import { loadShowWelcome } from './settings/settingsManager';
import { WelcomeView } from './ui/views/WelcomeView';
import { MainView } from './ui/views/MainView';
import { ProcessingView } from './ui/views/ProcessingView';
import { registerServiceWorker } from './pwa/registerSW';
import { renderAboutButton } from './ui/components/AboutDialog';

const root = document.getElementById('app')!;

function renderHeader(): HTMLElement {
  const header = document.createElement('div');
  header.className = 'app-header';
  header.innerHTML = `<h1>Sample Trimmer</h1>`;
  return header;
}

let currentView: MainView | ProcessingView | null = null;
let welcomeOverlay: HTMLElement | null = null;

function showMain(): void {
  currentView?.destroy?.();
  const mainView = new MainView(() => showProcessing());
  currentView = mainView;
  renderBody(mainView.element);
}

function showProcessing(): void {
  currentView?.destroy?.();
  const processingView = new ProcessingView(appState.files, () => showMain());
  currentView = processingView;
  renderBody(processingView.element);
}

function renderBody(viewEl: HTMLElement): void {
  root.replaceChildren(renderHeader(), viewEl, renderAboutButton());
  if (welcomeOverlay) root.append(welcomeOverlay);
}

async function bootstrap(): Promise<void> {
  await appState.init();
  showMain();

  if (loadShowWelcome()) {
    welcomeOverlay = new WelcomeView(() => {
      welcomeOverlay?.remove();
      welcomeOverlay = null;
    }).element;
    root.append(welcomeOverlay);
  }

  registerServiceWorker();
}

bootstrap();
