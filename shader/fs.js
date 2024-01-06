export const fs = /*glsl*/ `
precision highp float;
#define MAX_STEPS 100
#define MAX_DIST 10.
#define SURF_DIST .001
#define PI 3.141592653589793
#define S smoothstep
#define T iTime

uniform float iTime;
uniform float interval;
uniform vec2 resolution;
uniform mat4 cameraWorldMatrix;
uniform mat4 cameraProjectionMatrixInverse;
uniform samplerCube cubeTexture;
uniform float backgroundIntensity;

// "[TUT] Bending Light - Part 2" 
// by Martijn Steinrucken aka The Art of Code/BigWings - 2021
// The MIT License
// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
// Email: countfrolic@gmail.com
// Twitter: @The_ArtOfCode
// YouTube: youtube.com/TheArtOfCodeIsCool
// Facebook: https://www.facebook.com/groups/theartofcode/

mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
}

float sdBox(vec3 p, vec3 s) {
    p = abs(p)-s;
	return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
}

float GetDist(vec3 p) {
    float t = iTime*PI*4.0/interval;
    p -= vec3(-2.0*cos(t), 0.25-cos(t), 2.0*sin(t));
    p.xz *= Rot(t*2.0);
    
    float d = sdBox(p, vec3(1));
    
    float c = cos(3.1415/5.), s=sqrt(0.75-c*c);
    vec3 n = vec3(-0.5, -c, s);
    
    p = abs(p);
    p -= 2.*min(0., dot(p, n))*n;
    
    p.xy = abs(p.xy);
    p -= 2.*min(0., dot(p, n))*n;
    
    p.xy = abs(p.xy);
    p -= 2.*min(0., dot(p, n))*n;
    
    d = p.z-1.;
    return d;
}

float RayMarch(vec3 ro, vec3 rd, float side) {
	float dO=0.;
    
    for(int i=0; i<MAX_STEPS; i++) {
    	vec3 p = ro + rd*dO;
        float dS = GetDist(p)*side;
        dO += dS;
        if(dO>MAX_DIST || abs(dS)<SURF_DIST) break;
    }
    
    return dO;
}

vec3 GetNormal(vec3 p) {
	float d = GetDist(p);
    vec2 e = vec2(.01, 0);
    
    vec3 n = d - vec3(
        GetDist(p-e.xyy),
        GetDist(p-e.yxy),
        GetDist(p-e.yyx));
    
    return normalize(n);
}

void main() {
    vec2 screenPos = ( gl_FragCoord.xy * 2.0 - resolution ) / resolution;
    vec4 ndcRay = vec4( screenPos.xy, 1.0, 1.0 );
    vec3 rd = ( cameraWorldMatrix * cameraProjectionMatrixInverse * ndcRay ).xyz;
    rd = normalize( rd );
    vec3 ro = cameraPosition;
    vec3 col = textureCube(cubeTexture, rd).rgb * backgroundIntensity;

    float d = RayMarch(ro, rd, 1.); // outside of object
    
    float IOR = 1.45; // index of refraction
    
    if(d<MAX_DIST) {
        vec3 p = ro + rd * d; // 3d hit position
        vec3 n = GetNormal(p); // normal of surface... orientation
        vec3 r = reflect(rd, n);
        vec3 refOutside = textureCube(cubeTexture, r).rgb * backgroundIntensity;
        
        vec3 rdIn = refract(rd, n, 1./IOR); // ray dir when entering
        
        vec3 pEnter = p - n*SURF_DIST*3.;
        float dIn = RayMarch(pEnter, rdIn, -1.); // inside the object
        
        vec3 pExit = pEnter + rdIn * dIn; // 3d position of exit
        vec3 nExit = -GetNormal(pExit); 
        
        vec3 reflTex = vec3(0);
        
        vec3 rdOut = vec3(0);
        
        float abb = .01;
        
        // red
        rdOut = refract(rdIn, nExit, IOR-abb);
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit);
        reflTex.r = textureCube(cubeTexture, rdOut).r * backgroundIntensity;
        
        // green
        rdOut = refract(rdIn, nExit, IOR);
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit);
        reflTex.g = textureCube(cubeTexture, rdOut).g * backgroundIntensity;
        
        // blue
        rdOut = refract(rdIn, nExit, IOR+abb);
        if(dot(rdOut, rdOut)==0.) rdOut = reflect(rdIn, nExit);
        reflTex.b = textureCube(cubeTexture, rdOut).b * backgroundIntensity;
        
        float dens = .1;
        float optDist = exp(-dIn*dens);
        
        reflTex = reflTex*optDist;
        
        float fresnel = pow(1.+dot(rd, n), 5.);
        
        col = mix(reflTex, refOutside, fresnel);
    }
    gl_FragColor = vec4(col,1.0);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;
