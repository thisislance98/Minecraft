// DEPRECATED: Replaced by three-perf integration in VoxelGame
export class Profiler {
    constructor() { }
    start() { }
    end() { }
    enable() { }
    getReport() { return []; }
}
constructor() {
    this.enabled = false;
    this.datasets = new Map(); // label -> { sum, avg }
    this.pendingStarts = new Map(); // label -> timestamp
    this.order = [];
}

enable(state = true) {
    this.enabled = state;
    if (!state) {
        this.datasets.clear();
        this.order = [];
        this.pendingStarts.clear();
    }
}

start(label) {
    if (!this.enabled) return;
    this.pendingStarts.set(label, performance.now());

    if (!this.datasets.has(label)) {
        this.datasets.set(label, { sum: 0, avg: 0 });
        this.order.push(label);
    }
}

end(label) {
    if (!this.enabled) return;
    const start = this.pendingStarts.get(label);
    if (!start) return;

    const duration = performance.now() - start;
    const data = this.datasets.get(label);
    data.sum += duration;

    this.pendingStarts.delete(label);
}

// Called at end of frame to update averages
tick() {
    if (!this.enabled) return;
    const alpha = 0.05; // Smoothing factor

    for (const data of this.datasets.values()) {
        // Update Average
        // If it's the first frame, just set it
        if (data.avg === 0 && data.sum > 0) data.avg = data.sum;
        else data.avg = (data.avg * (1 - alpha)) + (data.sum * alpha);

        // Reset sum for next frame
        data.sum = 0;
    }
}

getReport() {
    return this.order.map(label => {
        const data = this.datasets.get(label);
        return {
            label,
            time: data.avg
        };
    });
}
}
