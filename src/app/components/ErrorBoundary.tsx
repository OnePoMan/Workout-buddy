import { Component, type ReactNode } from 'react';
import { STORAGE_KEY, browserStore } from '../../storage/storage';

interface State {
  error: Error | null;
}

/**
 * Last-resort screen for render errors. Offers the raw saved data as a
 * download, because the normal Settings export may be the thing that broke.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  private downloadData = () => {
    let raw: string | null = null;
    try {
      raw = browserStore()?.getItem(STORAGE_KEY) ?? null;
    } catch {
      raw = null;
    }
    if (raw === null) {
      window.alert('No saved data was found on this device.');
      return;
    }
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workout-buddy-recovery.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="main">
        <div className="screen">
          <header className="slab slab-title">
            <h1>SOMETHING BROKE</h1>
          </header>
          <section className="card" role="alert">
            <p>Workout Buddy hit an unexpected error. Your saved data has not been changed.</p>
            <p className="hint mono">{error.message}</p>
            <div className="button-col">
              <button type="button" className="btn btn-primary btn-wide" onClick={() => window.location.reload()}>
                RELOAD
              </button>
              <button type="button" className="btn btn-wide" onClick={this.downloadData}>
                DOWNLOAD SAVED DATA
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }
}
