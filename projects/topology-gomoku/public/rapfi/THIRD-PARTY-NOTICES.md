# Rapfi third-party notices

The local planar Gomoku engine is Rapfi, copyright Rapfi developers, distributed under GNU GPL v3 or later. The WASM engine is supplied from an existing local Rapfi 0.43.01 package. The source project and corresponding source are available at <https://github.com/dhbloo/rapfi>. See `Rapfi-GPL-3.0.txt` and `Rapfi-AUTHORS.txt`.

The Rapfi network weights are CC0 1.0; see `Rapfi-networks-CC0.txt`. The upstream Emscripten runtime is embedded in the generated loader; Rapfi's upstream license files include its runtime notices.

This application uses Rapfi only for the ordinary planar board. Wrapped and non-orientable modes use the application's topology-aware search worker because Rapfi's documented Gomoku/Renju interface does not establish support for those surface rules.
