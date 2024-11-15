{ pkgs ? import <nixpkgs> {} }:
pkgs.mkShell {
  buildInputs = [
    pkgs.nodejs
    pkgs.live-server
    pkgs.http-server
    pkgs.nodemon
  ];
  
  # Add the bin directories of the installed packages to the PATH
  shellHook = ''
    export PATH="$PATH:${pkgs.nodejs}/bin:${pkgs.live-server}/bin:${pkgs.http-server}/bin:${pkgs.nodemon}/bin"
  '';
}
