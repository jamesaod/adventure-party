# Offline tangent-space normal data; source color remains unchanged.
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
public static class GrassNormals {
 public static void Build(string source,string target) {
  const int n=256;
  using(var original=new Bitmap(source)) using(var im=new Bitmap(original,n,n)) using(var output=new Bitmap(n,n)) {
   var h=new double[n*n]; var smooth=new double[n*n];
   for(int y=0;y<n;y++)for(int x=0;x<n;x++) {var c=im.GetPixel(x,y);h[y*n+x]=(c.R*.2126+c.G*.7152+c.B*.0722)/255.0;}
   // Mild wrapped smoothing suppresses grain without erasing blade detail.
   for(int y=0;y<n;y++)for(int x=0;x<n;x++) {
    double v=0;for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++)v+=h[((y+j+n)%n)*n+(x+i+n)%n]*(i==0?2:1)*(j==0?2:1);
    smooth[y*n+x]=v/16;
   }
   for(int y=0;y<n;y++)for(int x=0;x<n;x++) {
    double dx=(smooth[y*n+(x+1)%n]-smooth[y*n+(x+n-1)%n])*2.2;
    double dy=(smooth[((y+1)%n)*n+x]-smooth[((y+n-1)%n)*n+x])*2.2;
    double length=Math.Sqrt(dx*dx+dy*dy+1);
    output.SetPixel(x,y,Color.FromArgb((int)Math.Round(127.5*(1-dx/length)),(int)Math.Round(127.5*(1+dy/length)),(int)Math.Round(127.5*(1+1/length))));
   }
   output.Save(target,System.Drawing.Imaging.ImageFormat.Png);
  }
 }
}
'@
$repoRoot = Split-Path $PSScriptRoot -Parent
[GrassNormals]::Build((Join-Path $repoRoot 'assets/textures/exploration/grass-short-v1.png'),(Join-Path $repoRoot 'assets/textures/exploration/grass-short-v1-normal.png'))
