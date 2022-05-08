const bar_number = 50;
const canvas_max_width_percent = 0.8;
const canvas_height_scale = 0.3;
const phase_speed = 0.1;
const phase_offset = 0.5;
const avg_bar = 0.8;
const time_bar_swap = 20;
const time_transition_to_sin = 500;
const bar_color_1 = "#039dfc";
const bar_color_2 = "#5ec2ff";
const bar_color_high_1 = "#FFCD00"; //highlighted bar
const bar_color_high_2 = "#ffe05e"; //highlighted bar
const normal_body_color = "#ffffff";
const second_body_color = "#000000";
const second_demo_description_container_color = "#444444";

var audio_jump1 = new Audio('sounds/jump.mp4');

const canvas_container = document.getElementById('canvas_container');
var bar_canvas;
var ctx;
var raf; //raf = window.requestAnimationFrame(draw_bars);

var a = {};
for(var i = 0; i < bar_number; ++i) a[i] = Math.round(Math.random()*200);
var swaps = {};

var bar_width = 0;
var phase = 0;
var swaps = {};





//Beginning of init

init_canvas();
raf = window.requestAnimationFrame(draw_bars);

window.addEventListener('resize', init_canvas);

// const coding_container = document.getElementById('coding_container');
// var flag_normal = true;
// document.addEventListener('scroll', function(e) {
//     if(flag_normal && 2 * coding_container.getBoundingClientRect().top <= window.innerHeight &&
//     2 * coding_container.getBoundingClientRect().top + 2 * coding_container.getBoundingClientRect().height >= window.innerHeight)
//     {
//         document.body.style.backgroundColor = second_body_color;
//         var demo_description_container_class = document.getElementsByClassName("demo_description_container");
//         for(var i = 0; i < demo_description_container_class.length; ++i) {
//             demo_description_container_class[i].style.backgroundColor = second_demo_description_container_color;
//         }

//         flag_normal = false;
//     }
//     else if(!flag_normal && (2 * coding_container.getBoundingClientRect().top > window.innerHeight ||
//     2 * coding_container.getBoundingClientRect().top + 2 * coding_container.getBoundingClientRect().height < window.innerHeight))
//     {
//         document.body.style.backgroundColor = normal_body_color;
//         var demo_description_container_class = document.getElementsByClassName("demo_description_container");
//         for(var i = 0; i < demo_description_container_class.length; ++i) {
//             demo_description_container_class[i].style.backgroundColor = normal_body_color;
//         }

//         flag_normal = true;
//     }
// });

//End of init





function play_audio_jump1() {
    audio_jump1.play();
}


function quick_sort_bars_manager() {

    bar_canvas.removeEventListener('touchstart', quick_sort_bars_manager);
    bar_canvas.removeEventListener('click', quick_sort_bars_manager);

    //Stop drawing sin
    window.cancelAnimationFrame(raf);

    //Quick_sort array b
    var b = {};
    for(var i = 0; i < bar_number; ++i) b[i] = a[i];

    var cnt_swaps = 0;
    heapsort_bars(b, bar_number);

    var counter = 0;
    highlight_interval = setInterval(draw_highlight, time_bar_swap);




    //functions
    function swap_in_arr(m, i, j) {
        let temp = b[i];
        b[i] = b[j];
        b[j] = temp;

        swaps[cnt_swaps] = {
            first: i,
            second: j
        }
        ++cnt_swaps;
    }

    function rebuild(m, father, last_ind)
    {
        var maxSon;
        while(father <= (last_ind - 1) / 2)
        {
            maxSon = 2 * father + 1;
            if(2 * father + 2 <= last_ind && m[maxSon + 1] > m[maxSon]) ++maxSon;

            if(m[maxSon] > m[father])
            {
                swap_in_arr(m, maxSon, father);
                father = maxSon;
            }
            else father = last_ind;
        }
    }

    function heapsort_bars(m, n)
    {
        for(var i = n/2 - 1; i >= 0; --i)
            rebuild(m, i, n - 1);

        swap_in_arr(m, 0, n - 1);

        for(var i = n - 2; i > 0; --i)
        {
            rebuild(m, 0, i);
            swap_in_arr(m, 0, i);
        }
    }

    function draw_highlight() {
        if(counter < cnt_swaps)
        {
            let h = Math.round(bar_width * bar_number * canvas_height_scale / 2);
            let i = swaps[counter].first, j = swaps[counter].second;

            var gradient;

            
            //Draw old bars with regular color
            if(counter >= 1)
            {
                let oldi = swaps[counter - 1].first;
                let oldj = swaps[counter - 1].second;
                let h = Math.round(bar_width * bar_number * canvas_height_scale / 2);

                gradient = ctx.createLinearGradient(0, h - Math.round(a[oldi] / 2), 0, h + Math.round(a[oldi] / 2));
                gradient.addColorStop(0, bar_color_1);
                gradient.addColorStop(0.5, bar_color_2);
                gradient.addColorStop(1, bar_color_1);
                ctx.fillStyle = gradient;
                ctx.fillRect(oldi * bar_width, h - Math.round(a[oldi] / 2), bar_width, a[oldi]);

                gradient = ctx.createLinearGradient(0, h - Math.round(a[oldj] / 2), 0, h + Math.round(a[oldj] / 2));
                gradient.addColorStop(0, bar_color_1);
                gradient.addColorStop(0.5, bar_color_2);
                gradient.addColorStop(1, bar_color_1);
                ctx.fillStyle = gradient;
                ctx.fillRect(oldj * bar_width, h - Math.round(a[oldj] / 2), bar_width, a[oldj]);
            }


            //Clear unwanted parts if needed
            if(a[i] > a[j])
            {
                ctx.clearRect(i * bar_width, h - Math.round(a[i] / 2), bar_width, a[i] - a[j]);
                ctx.clearRect(i * bar_width, h - Math.round(a[i] / 2) + a[i], bar_width, a[j] - a[i]);
            }
            else if (a[i] < a[j])
            {
                ctx.clearRect(j * bar_width, h - Math.round(a[j] / 2), bar_width, a[j] - a[i]);
                ctx.clearRect(j * bar_width, h - Math.round(a[j] / 2) + a[j], bar_width, a[i] - a[j]);
            }
            

            //Draw new bars with highlight colors
            gradient = ctx.createLinearGradient(0, h - Math.round(a[j] / 2), 0, h + Math.round(a[j] / 2));
            gradient.addColorStop(0, bar_color_high_1);
            gradient.addColorStop(0.5, bar_color_high_2);
            gradient.addColorStop(1, bar_color_high_1);
            ctx.fillStyle = gradient;
            ctx.fillRect(i * bar_width, h - Math.round(a[j] / 2), bar_width, a[j]);

            gradient = ctx.createLinearGradient(0, h - Math.round(a[i] / 2), 0, h + Math.round(a[i] / 2));
            gradient.addColorStop(0, bar_color_high_1);
            gradient.addColorStop(0.5, bar_color_high_2);
            gradient.addColorStop(1, bar_color_high_1);
            ctx.fillStyle = gradient;
            ctx.fillRect(j * bar_width, h - Math.round(a[i] / 2), bar_width, a[i]);


            //Make swap in a
            let temp = a[j];
            a[j] = a[i];
            a[i] = temp;

            ++counter;
        }
        else
        {
            if(counter >= 1)
            {
                let oldi = swaps[counter - 1].first, oldj = swaps[counter - 1].second;
                let h = Math.round(bar_width * bar_number * canvas_height_scale / 2);
                
                var gradient = ctx.createLinearGradient(0, h - Math.round(a[oldj] / 2), 0, h + Math.round(a[oldj] / 2));
                gradient.addColorStop(0, bar_color_1);
                gradient.addColorStop(0.5, bar_color_2);
                gradient.addColorStop(1, bar_color_1);
                ctx.fillStyle = gradient;
                ctx.fillRect(oldj * bar_width, h - Math.round(a[oldj] / 2), bar_width, a[oldj]);

                gradient = ctx.createLinearGradient(0, h - Math.round(a[oldi] / 2), 0, h + Math.round(a[oldi] / 2));
                gradient.addColorStop(0, bar_color_1);
                gradient.addColorStop(0.5, bar_color_2);
                gradient.addColorStop(1, bar_color_1);
                ctx.fillStyle = gradient;
                ctx.fillRect(oldi * bar_width, h - Math.round(a[oldi] / 2), bar_width, a[oldi]);
            }

            //Stop drawing sort
            clearInterval(highlight_interval);

            //smooth transition to sin
            let temp_canvas_height = Math.round(bar_width * bar_number * canvas_height_scale);
            for(var i = 0; i < bar_number; ++i)
            {
                a[i] = Math.sin(phase + i * phase_offset) * temp_canvas_height * (1 - avg_bar) + temp_canvas_height * avg_bar;
                a[i] *= Math.sin(Math.PI * ((i + 0.5) * bar_width) /(bar_width * bar_number));
                a[i] = Math.round(a[i]);
            }



            var c = {};
            for(var i = 0; i < bar_number; ++i) c[i] = b[i];

            const start = Date.now();
            trans_bar = window.requestAnimationFrame(draw_trans_bar);

            function draw_trans_bar()
            {
                let h = Math.round(bar_width * bar_number * canvas_height_scale / 2);
                let date_change = Date.now() - start;

                if(date_change < time_transition_to_sin)
                {
                    for(var i = 0; i < bar_number; ++i)
                    {
                        let old_c_i = c[i];
                        c[i] = b[i] + (a[i] - b[i]) * (date_change / time_transition_to_sin) * (date_change / time_transition_to_sin);
                        c[i] = Math.round(c[i]);

                        //Clear unwanted parts if needed
                        if(old_c_i > c[i])
                        {
                            ctx.clearRect(i * bar_width, h - Math.round(old_c_i / 2), bar_width, old_c_i - c[i]);
                            ctx.clearRect(i * bar_width, h - Math.round(old_c_i / 2) + old_c_i, bar_width, c[i] - old_c_i);
                        }

                        //Draw new bar
                        let gradient = ctx.createLinearGradient(0, h - Math.round(c[i] / 2), 0, h + Math.round(c[i] / 2));
                        gradient.addColorStop(0, bar_color_1);
                        gradient.addColorStop(0.5, bar_color_2);
                        gradient.addColorStop(1, bar_color_1);

                        ctx.fillStyle = gradient;
                        ctx.fillRect(i * bar_width, h - Math.round(c[i] / 2), bar_width, c[i]);
                    }

                    trans_bar = window.requestAnimationFrame(draw_trans_bar);
                }
                else
                {
                    //end
                    window.cancelAnimationFrame(draw_trans_bar);
                    
                    for(var i = 0; i < bar_number; ++i)
                    {
                        let old_c_i = c[i];
                        c[i] = a[i];
                        c[i] = Math.round(c[i]);

                        //Clear unwanted parts if needed
                        if(old_c_i > c[i])
                        {
                            ctx.clearRect(i * bar_width, h - Math.round(old_c_i / 2), bar_width, old_c_i - c[i]);
                            ctx.clearRect(i * bar_width, h - Math.round(old_c_i / 2) + old_c_i, bar_width, c[i] - old_c_i);
                        }

                        //Draw new bar
                        let gradient = ctx.createLinearGradient(0, h - Math.round(c[i] / 2), 0, h + Math.round(c[i] / 2));
                        gradient.addColorStop(0, bar_color_1);
                        gradient.addColorStop(0.5, bar_color_2);
                        gradient.addColorStop(1, bar_color_1);

                        ctx.fillStyle = gradient;
                        ctx.fillRect(i * bar_width, h - Math.round(c[i] / 2), bar_width, c[i]);
                    }

                    //Continue drawing sin
                    raf = window.requestAnimationFrame(draw_bars);
                    bar_canvas.addEventListener('touchstart', quick_sort_bars_manager);
                    bar_canvas.addEventListener('click', quick_sort_bars_manager);
                }

            }
        }
    }
}

function draw_bars() {
    let h = Math.round(bar_width * bar_number * canvas_height_scale / 2);
    let temp_canvas_height = Math.round(bar_width * bar_number * canvas_height_scale);

    for(var i = 0; i < bar_number; ++i)
    {
        let old_a_i = a[i];
        a[i] = Math.sin(phase + i * phase_offset) * temp_canvas_height * (1 - avg_bar) + temp_canvas_height * avg_bar;
        a[i] *= Math.sin(Math.PI * ((i + 0.5) * bar_width) /(bar_width * bar_number));
        a[i] = Math.round(a[i]);
        

        //Clear unwanted parts if needed
        if(old_a_i > a[i])
        {
            ctx.clearRect(i * bar_width, h - Math.round(old_a_i / 2), bar_width, old_a_i - a[i]);
            ctx.clearRect(i * bar_width, h - Math.round(old_a_i / 2) + old_a_i, bar_width, a[i] - old_a_i);
        }

        //Draw new bar
        let gradient = ctx.createLinearGradient(0, h - Math.round(a[i] / 2), 0, h + Math.round(a[i] / 2));
        gradient.addColorStop(0, bar_color_1);
        gradient.addColorStop(0.5, bar_color_2);
        gradient.addColorStop(1, bar_color_1);

        ctx.fillStyle = gradient;
        ctx.fillRect(i * bar_width, h - Math.round(a[i] / 2), bar_width, a[i]);
    }

    //add phase_speed to phase and draw new frame
    phase += phase_speed;
    raf = window.requestAnimationFrame(draw_bars);
}

function init_canvas() //Delete old canvas, create new, draw bars
{
    if(bar_width == Math.round(canvas_container.parentElement.offsetWidth * canvas_max_width_percent / bar_number)) return;

    canvas_container.removeChild(canvas_container.lastChild); //Delete old canvas

    bar_canvas = document.createElement('canvas');

    bar_width = Math.round(canvas_container.parentElement.offsetWidth * canvas_max_width_percent / bar_number);
    bar_canvas.width = bar_width * bar_number;
    bar_canvas.height = Math.round(bar_width * bar_number * canvas_height_scale);

    canvas_container.appendChild(bar_canvas);

    ctx = bar_canvas.getContext('2d');
   
    
    let h = Math.round(bar_width * bar_number * canvas_height_scale / 2);

    for(var i = 0; i < bar_number; ++i)
    {
        let gradient = ctx.createLinearGradient(0, h - Math.round(a[i] / 2), 0, h + Math.round(a[i] / 2));
        gradient.addColorStop(0, bar_color_1);
        gradient.addColorStop(0.5, bar_color_2);
        gradient.addColorStop(1, bar_color_1);

        ctx.fillStyle = gradient;
        ctx.fillRect(i * bar_width, h - Math.round(a[i] / 2), bar_width, a[i]);
    }

    bar_canvas.addEventListener('touchstart', quick_sort_bars_manager);
    bar_canvas.addEventListener('click', quick_sort_bars_manager);
}