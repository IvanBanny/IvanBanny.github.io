var main_ass_inf;
var $dragging = null;

function compare_dates(due1, due2, lvl1, lvl2) {
    if(due1[3] * 10 + due1[4] > due2[3] * 10 + due2[4]) return true;
    else if(due1[3] * 10 + due1[4] < due2[3] * 10 + due2[4]) return false;
    else {
        if(due1[0] * 10 + due1[1] > due2[0] * 10 + due2[1]) return true;
        else if(due1[0] * 10 + due1[1] < due2[0] * 10 + due2[1]) return false;
        else {
            return (lvl1 < lvl2);
        }
    }
}

function add_existing_assignment(c_subject, c_due, c_lvl, c_text_description, before)
{
    assignment = document.createElement('div');
    assignment.setAttribute("class", "assignment");
    if(before == null) document.getElementById("main_assignments_container").appendChild(assignment);
    else document.getElementById("main_assignments_container").insertBefore(assignment, before);

    description = document.createElement("p");
    description.setAttribute("class", "assignment_description");
    description.appendChild(document.createTextNode(c_text_description));
    assignment.appendChild(description);
    
    switch (c_lvl) {
        case "1":
            description.style.backgroundColor = "#d6ffd1";
            break;
        case "2":
            description.style.backgroundColor = "#ecffb8";
            break;
        case "3":
            description.style.backgroundColor = "#fffbb0";
            break;
        case "4":
            description.style.backgroundColor = "#ffdac7";
            break;
        case "5":
            description.style.backgroundColor = "#ffc7c7";
            break;
    }

    assignment_slot = document.createElement('div');
    assignment_slot.setAttribute("class", "assignment_slot");
    assignment.insertBefore(assignment_slot, description);

    assignment_slot_cover = document.createElement('div');
    assignment_slot_cover.setAttribute("class", "assignment_slot_cover");
    assignment_slot.appendChild(assignment_slot_cover);

    assignment_slider = document.createElement('div');
    assignment_slider.setAttribute("class", "assignment_slider");
    assignment_slot.insertBefore(assignment_slider, assignment_slot_cover);

    assignment_label_date_container = document.createElement('div');
    assignment_label_date_container.setAttribute("class", "assignment_label_date_container");
    assignment_slot.insertBefore(assignment_label_date_container, assignment_slider);

    assignment_due = document.createElement("p");
    assignment_due.setAttribute("class", "assignment_due");
    assignment_due.appendChild(document.createTextNode(c_due));
    assignment_label_date_container.appendChild(assignment_due);

    assignment_subject = document.createElement("p");
    assignment_subject.setAttribute("class", "assignment_subject");
    assignment_subject.appendChild(document.createTextNode(c_subject));
    assignment_label_date_container.insertBefore(assignment_subject, assignment_due);
}

function add_new_assignment(c_subject, c_due, c_lvl, c_text_description) {
    var n = 0;
    for (; n < main_ass_inf.n && compare_dates(c_due, main_ass_inf.arr[n].due, c_lvl, main_ass_inf.arr[n].lvl); ++n) {};

    for (let i = main_ass_inf.n; i > n && i > 0; --i) {
        main_ass_inf.arr[i] = main_ass_inf.arr[i - 1];
    };

    main_ass_inf.arr[n] = {
        subject: c_subject,
        due: c_due,
        lvl: c_lvl,
        text_description: c_text_description
    };

    ++main_ass_inf.n;

    if(main_ass_inf.n == 1) add_existing_assignment(c_subject, c_due, c_lvl, c_text_description, null);
    else add_existing_assignment(c_subject, c_due, c_lvl, c_text_description, $(".assignment")[n]);

    make_slider_draggable(n);
}

function make_slider_draggable(n) {
    const assignment = $(".assignment")[n];
    const slot = assignment.querySelector(".assignment_slot");
    const slider = slot.querySelector(".assignment_slider");
    const slot_cover = slot.querySelector(".assignment_slot_cover");

    const label_date_container = slot.querySelector(".assignment_label_date_container");
    const subject = label_date_container.querySelector(".assignment_subject");
    const due = label_date_container.querySelector(".assignment_due");
    const description = assignment.querySelector(".assignment_description");

    $(slider).draggable({
        axis: "x", containment :
        [$(slot).position().left, 0, $(slot).position().left + $(slot).width() - $(slider).width(), 0],
        drag: function(ev, ui) {
            slot_cover.style.width = $(slot).width() - $(slider).position().left - getComputedStyle(slider).borderWidth[0] + "px";
        },
        stop: function(ev, ui) {
            if(2 * $(slider).position().left + $(slider).width() >= $(slot).width())
            {
                slot_cover.style.width = "0px";

                slider.style.left = "";
                slider.style.right = "0px";
            }
            else
            {
                slot_cover.style.width = $(slot).position().left - 2 + "px";

                slider.style.left = "-" + getComputedStyle(slider).borderWidth;

                $(assignment).fadeOut(500, function() {
                    assignment.remove();
                });

                //delete assignment from main_ass_inf:
                const pos = find_in_main_ass_inf(subject.innerHTML, due.innerHTML, description.innerHTML)

                for(let i = pos; i < main_ass_inf.n - 1; ++i)
                    main_ass_inf.arr[i] = main_ass_inf.arr[i + 1];
                
                --main_ass_inf.n;
            }
        }
    });
}

function find_in_main_ass_inf(c_subject, c_due, c_text_description)
{
    for(let i = 0; i < main_ass_inf.n; ++i)
    {
        if(main_ass_inf.arr[i].due == c_due)
            if(main_ass_inf.arr[i].subject == c_subject)
                if(main_ass_inf.arr[i].text_description == c_text_description)
                    return i;
    }
    return null;
}

function add_assignment_button_click1() {
    document.getElementById("add_assignment_blur").style.display = "flex";
}

function add_assignment_button_click2() {
    document.getElementById("add_assignment_blur").style.display = "none";

    add_new_assignment(document.getElementById("add_assignment_input_subject").value,
     document.getElementById("add_assignment_input_due").value,
      document.getElementById("add_assignment_input_lvl").value,
     document.getElementById("add_assignment_input_description").value);
}

window.addEventListener('resize', function(event) {
    for(let i = 0; i < main_ass_inf.n; ++i) make_slider_draggable(i);
}, true);

$(window).on("beforeunload", function() { 
    localStorage.setItem("main_ass_inf", JSON.stringify(main_ass_inf));
});











//get main_ass_inf
if(localStorage.getItem("main_ass_inf") == null)
    localStorage.setItem("main_ass_inf", `{
        "n": 1,
        "arr": [{
            "subject": "example",
            "due": "29.06",
            "lvl": 5,
            "text_description": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
        }]
    }`);

main_ass_inf = JSON.parse(localStorage.getItem("main_ass_inf"));

//restore assignments from main_ass_inf
for(let i = 0; i < main_ass_inf.n; ++i) {
    add_existing_assignment(main_ass_inf.arr[i].subject, main_ass_inf.arr[i].due,
            main_ass_inf.arr[i].lvl, main_ass_inf.arr[i].text_description, null);

    //make_slider_draggable(i);
}

for(let i = 0; i < main_ass_inf.n; ++i) make_slider_draggable(i);